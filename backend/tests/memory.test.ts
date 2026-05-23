import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../src/database/client';
import {
  __setMemoryServiceForTesting,
  searchMemoryForCall,
  type MemoryService,
  type CallerMemory,
} from '../src/services/memory';

/**
 * In-memory fake of the mem0-backed service. Lets us prove the round-trip
 * (call 1 writes → call 2 reads back) without standing up the real mem0
 * cloud in tests. The real service is exercised live against MEM0_API_KEY
 * when the env is set.
 */
function fakeMemoryService(): MemoryService & { _store: Map<string, CallerMemory[]> } {
  const store = new Map<string, CallerMemory[]>();
  return {
    enabled: true,
    _store: store,
    async add(email, summary) {
      const key = email.trim().toLowerCase();
      const entry: CallerMemory = {
        id: uuidv4(),
        text: summary,
        createdAt: new Date().toISOString(),
      };
      store.set(key, [...(store.get(key) ?? []), entry]);
    },
    async search(email) {
      const key = email.trim().toLowerCase();
      return store.get(key) ?? [];
    },
  };
}

describe('cross-call memory round-trip', () => {
  afterAll(() => {
    __setMemoryServiceForTesting(null);
  });

  it('a memory stored on call 1 is retrievable for call 2 with the same email', async () => {
    const fake = fakeMemoryService();
    __setMemoryServiceForTesting(fake);

    const email = `mem-test-${uuidv4().slice(0, 8)}@example.com`;

    // call 1 — caller introduces themselves, agent records email, eventually
    // the SUMMARIZE_CALL activity would store a memory. We bypass the LLM and
    // store the summary directly through the same service the activity uses.
    const call1 = await prisma.call.create({
      data: {
        id: uuidv4(),
        callerEmail: email,
        status: 'completed',
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });
    await fake.add(email, 'Caller asked about a billing question, ticket TICK-A1B2 opened.');

    // call 2 — different call, same email. get_caller_context should pull
    // the memory left by call 1.
    const call2 = await prisma.call.create({
      data: {
        id: uuidv4(),
        callerEmail: email,
        status: 'active',
        startedAt: new Date(),
      },
    });

    const { email: resolvedEmail, memories } = await searchMemoryForCall(call2.id);
    expect(resolvedEmail).toBe(email);
    expect(memories).toHaveLength(1);
    expect(memories[0].text).toMatch(/TICK-A1B2/);
    expect(call1.id).not.toBe(call2.id);
  });

  it('returns no memories when the call has no callerEmail set', async () => {
    __setMemoryServiceForTesting(fakeMemoryService());

    const call = await prisma.call.create({
      data: {
        id: uuidv4(),
        status: 'active',
        startedAt: new Date(),
      },
    });

    const { email, memories } = await searchMemoryForCall(call.id);
    expect(email).toBeNull();
    expect(memories).toEqual([]);
  });
});
