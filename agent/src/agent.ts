import { voice } from '@livekit/agents';
import { SYSTEM_INSTRUCTIONS } from './instructions.js';
import { buildLiveKitTools } from './tools-livekit.js';

/**
 * The voice agent. Instances are bound to a specific callId so tool
 * invocations queue workflows against the right Call row.
 */
export class CallFlowAgent extends voice.Agent {
  constructor(callId: string) {
    super({
      instructions: SYSTEM_INSTRUCTIONS,
      tools: buildLiveKitTools(callId),
    });
  }
}
