import './env.js'; // must be first — populates process.env before anything else loads
import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import { CallFlowAgent } from './agent.js';
import { backend } from './backend.js';

const { AgentSessionEventTypes } = voice;

interface ProcessUserData {
  vad: silero.VAD;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((p) => typeof p === 'string').join(' ').trim();
  }
  return '';
}

export default defineAgent<ProcessUserData>({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx) => {
    // Real callId comes from the room name the backend set when minting
    // the token. ctx.job.room is populated at dispatch time; ctx.room.name
    // is the same value once the room is initialised.
    const roomName = ctx.job.room?.name ?? ctx.room.name ?? '';
    if (!UUID_RE.test(roomName)) {
      console.error('agent: refusing dispatch, room name is not a valid callId', { roomName });
      return;
    }
    const callId = roomName;

    const session = new voice.AgentSession({
      stt: new inference.STT({ model: 'deepgram/nova-3', language: 'en' }),
      llm: new inference.LLM({ model: 'openai/gpt-4o-mini' }),
      tts: new inference.TTS({ model: 'cartesia/sonic-3' }),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad,
      voiceOptions: {
        preemptiveGeneration: true,
      },
    });

    // Persist every completed turn so the dashboard call detail page
    // shows the transcript. Tool/handoff items are ignored.
    session.on(AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const item: any = ev.item;
      if (item?.type !== 'message') return;
      const role = item.role === 'user' || item.role === 'assistant' ? item.role : null;
      const text = extractText(item.content);
      if (!role || !text) return;
      backend.saveMessage(callId, role, text).catch((err) => {
        console.error('agent: saveMessage failed', { err: err?.message });
      });
    });

    await session.start({
      agent: new CallFlowAgent(callId),
      room: ctx.room,
    });

    await ctx.connect();

    session.generateReply({
      instructions:
        'Greet in one short sentence, then ask for the caller\'s email to identify them. ' +
        'Do not ask what they need yet — wait until you have their email.',
    });
  },
});

// No `agentName` → automatic dispatch: the worker joins every room.
// Switch to explicit dispatch (set agentName + call AgentDispatchService
// from the backend) when you start running multiple distinct agents.
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  }),
);
