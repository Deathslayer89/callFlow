import { MemoryClient } from 'mem0ai';
import logger from '@callflow/shared/logger';
import { prisma } from '../database/client';

/**
 * Cross-call memory, backed by mem0 cloud. Chosen over Letta (full agent
 * runtime, more than we need) and Zep (needs a server) for the cleaner TS
 * SDK and the hosted tier that saves us a self-hosted vector store.
 *
 * Keyed by caller email, which we can't actually verify — two people could
 * give the same address. We log a notice when a new memory lands for an
 * email that already has some, but don't try to fork identities.
 *
 * Without MEM0_API_KEY the service is a noop: add/search return empty so
 * callers never need to branch on whether memory is configured.
 */

export interface CallerMemory {
  id: string;
  text: string;
  createdAt?: string;
}

export interface MemoryService {
  enabled: boolean;
  add(email: string, summary: string, metadata?: Record<string, unknown>): Promise<void>;
  search(email: string, query?: string): Promise<CallerMemory[]>;
}

let singleton: MemoryService | null = null;

function buildRealService(client: MemoryClient): MemoryService {
  return {
    enabled: true,

    async add(email, summary, metadata) {
      const userId = normalizeEmail(email);
      try {
        const existing = await client.search(' ', {
          filters: { user_id: userId },
          topK: 1,
        });
        if (existing.results.length > 0) {
          logger.info('memory.existing_user_seen', { userId });
        }
        await client.add(
          [{ role: 'user', content: summary }],
          { userId, metadata },
        );
        logger.info('memory.add', { userId });
      } catch (err: any) {
        logger.error('memory.add.failed', { userId, err: err?.message });
      }
    },

    async search(email, query) {
      const userId = normalizeEmail(email);
      try {
        const { results } = await client.search(query ?? 'recent context', {
          filters: { user_id: userId },
          topK: 5,
        });
        return results.map((m) => ({
          id: m.id,
          text: m.memory ?? '',
          createdAt: (m as any).created_at,
        }));
      } catch (err: any) {
        logger.error('memory.search.failed', { userId, err: err?.message });
        return [];
      }
    },
  };
}

const noopService: MemoryService = {
  enabled: false,
  async add() {
    /* no-op */
  },
  async search() {
    return [];
  },
};

export function getMemoryService(): MemoryService {
  if (singleton) return singleton;
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    logger.info('memory.disabled', { reason: 'MEM0_API_KEY not set' });
    singleton = noopService;
    return singleton;
  }
  singleton = buildRealService(new MemoryClient({ apiKey }));
  return singleton;
}

/** Test seam — lets integration tests swap in a fake without touching mem0. */
export function __setMemoryServiceForTesting(s: MemoryService | null) {
  singleton = s;
}

/**
 * Helper used by both the chat-side tool and the voice-side HTTP endpoint.
 * Resolves the call's callerEmail and searches memory for that user.
 */
export async function searchMemoryForCall(
  callId: string,
  query?: string,
): Promise<{ email: string | null; memories: CallerMemory[] }> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { callerEmail: true },
  });
  if (!call?.callerEmail) return { email: null, memories: [] };
  const memories = await getMemoryService().search(call.callerEmail, query);
  return { email: call.callerEmail, memories };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
