import { z } from 'zod';
import { MemoryClient } from 'mem0ai';
import { prisma } from '../db';
import logger from '@callflow/shared/logger';

/**
 * Write-side of cross-call memory, fired by /api/calls/end. Compresses the
 * transcript to a sentence or two and stores it in mem0 under the caller's
 * email. No-ops if mem0 isn't configured, the call had no email, or there
 * was nothing worth keeping.
 */

const summarizeCallSchema = z.object({
  callId: z.string().uuid(),
});

export type SummarizeCallInput = z.infer<typeof summarizeCallSchema>;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SUMMARY_SYSTEM_PROMPT =
  'You compress a customer support call into one or two sentences a future ' +
  'agent can use to recognise the caller. Mention the issue, any actions taken ' +
  '(ticket IDs, appointments), and outcome. Plain text only, under 60 words. ' +
  "If there's nothing useful, reply with the single word: SKIP.";

async function summarize(messages: { role: string; content: string }[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const model = process.env.MEM0_SUMMARY_MODEL || process.env.CHAT_MODEL || 'openai/gpt-4o-mini';

  const transcript = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    logger.warn('memory.summary.openrouter_failed', { status: res.status });
    return null;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text || text.toUpperCase() === 'SKIP') return null;
  return text;
}

export async function summarizeCall(rawInput: unknown): Promise<unknown> {
  const { callId } = summarizeCallSchema.parse(rawInput);

  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    logger.info('memory.summary.skipped', { callId, reason: 'mem0-not-configured' });
    return { stored: false, reason: 'mem0-not-configured' };
  }

  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      callerEmail: true,
      ticketId: true,
      messages: {
        orderBy: { timestamp: 'asc' },
        select: { role: true, content: true },
      },
    },
  });

  if (!call?.callerEmail) {
    logger.info('memory.summary.skipped', { callId, reason: 'no-caller-email' });
    return { stored: false, reason: 'no-caller-email' };
  }
  if (!call.messages || call.messages.length < 2) {
    logger.info('memory.summary.skipped', { callId, reason: 'no-conversation' });
    return { stored: false, reason: 'no-conversation' };
  }

  const summary = await summarize(call.messages);
  if (!summary) {
    return { stored: false, reason: 'summary-empty-or-skipped' };
  }

  const client = new MemoryClient({ apiKey });
  const userId = call.callerEmail.trim().toLowerCase();

  // Notice (not warning — repeat callers are the happy path here) when a user
  // already has memories. Just a signal that we're augmenting, not creating.
  try {
    const existing = await client.search(' ', { filters: { user_id: userId }, topK: 1 });
    if (existing.results.length > 0) {
      logger.info('memory.existing_user_seen', { userId });
    }
  } catch {
    // ignore — search failures shouldn't block the write
  }

  await client.add(
    [{ role: 'user', content: summary }],
    {
      userId,
      metadata: {
        callId,
        ticketId: call.ticketId ?? undefined,
      },
    },
  );

  logger.info('memory.summary.stored', { callId, userId, length: summary.length });
  return { stored: true, summary, userId };
}
