import { Readable } from 'node:stream';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { SYSTEM_INSTRUCTIONS } from '@callflow/shared/instructions';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../../database/client';
import { config } from '../../config';
import { computeCostUsd } from '../../services/cost';
import { buildAiSdkTools } from '../../services/aiTools';
import logger from '@callflow/shared/logger';

const router = Router();

const openrouter = createOpenRouter({ apiKey: config.openrouterApiKey });

const chatBodySchema = z.object({
  // useChat sends a list of UIMessages; we forward them to the model.
  messages: z.array(z.any()),
  // Optional: tie tool calls back to a specific call row.
  callId: z.string().uuid().optional(),
});

/**
 * POST /api/chat
 *
 * The dashboard's text-mode mirror of the voice agent: same tools, same
 * system prompt, different transport. Streams an AI SDK UI message
 * stream that `useChat` on the frontend consumes directly.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { messages, callId: providedCallId } = chatBodySchema.parse(req.body);

    // Tools reference a Call row via FK. If the caller didn't pass one,
    // create an ephemeral call so the workflow rows have somewhere to attach
    // (and so the conversation shows up in the dashboard).
    let callId = providedCallId;
    if (!callId) {
      const call = await prisma.call.create({
        data: {
          id: uuidv4(),
          status: 'active',
          startedAt: new Date(),
          metadata: { source: 'chat' },
        },
      });
      callId = call.id;
    }

    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = streamText({
      model: openrouter(config.chatModel),
      system: SYSTEM_INSTRUCTIONS,
      messages: modelMessages,
      tools: buildAiSdkTools(callId, { requestId: req.requestId }),
      stopWhen: ({ steps }) => steps.length >= 5,
      onFinish: async ({ usage }) => {
        const tokensIn = usage?.inputTokens ?? 0;
        const tokensOut = usage?.outputTokens ?? 0;
        if (!tokensIn && !tokensOut) return;
        try {
          await prisma.call.update({
            where: { id: callId! },
            data: {
              tokensInput: { increment: tokensIn },
              tokensOutput: { increment: tokensOut },
              costUsd: { increment: computeCostUsd(config.chatModel, tokensIn, tokensOut) },
            },
          });
        } catch (err) {
          logger.error('chat.cost.persist_failed', { callId, requestId: req.requestId, err });
        }
      },
    });

    const response = result.toUIMessageStreamResponse();
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status);
    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    } else {
      res.end();
    }
  }),
);

export default router;
