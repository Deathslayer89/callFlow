import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/client';
import {
  enqueueWorkflow,
  workflowQueue,
  closeWorkflowResources,
} from '@callflow/workflows';
import { closeWorker } from '../../workflows/src/workers/workflowWorker';
import { WorkflowType } from '@callflow/shared';

const app = createApp();

async function waitFor<T>(
  fn: () => Promise<T | null>,
  { timeoutMs = 10_000, intervalMs = 50 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

// Block until the worker has nothing in flight. Without this, the next test's
// beforeEach can truncate workflow rows while the worker is mid-update, which
// produces noisy "Record to update not found" errors.
async function drainQueue(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const c = await workflowQueue.getJobCounts('waiting', 'active', 'delayed');
    if (c.waiting === 0 && c.active === 0 && c.delayed === 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('queue did not drain');
}

afterEach(async () => {
  await drainQueue();
});

afterAll(async () => {
  await closeWorker();
  await closeWorkflowResources();
});

describe('full workflow path', () => {
  it('POST /api/calls/start persists a Call', async () => {
    const res = await request(app)
      .post('/api/calls/start')
      .send({ phoneNumber: '+15551234567' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);

    const row = await prisma.call.findUnique({ where: { id: res.body.data.id } });
    expect(row?.phoneNumber).toBe('+15551234567');
    expect(row?.status).toBe('active');
  });

  it('enqueueWorkflow runs the activity and marks the row completed', async () => {
    const call = await prisma.call.create({
      data: { id: '00000000-0000-0000-0000-000000000001', status: 'active', startedAt: new Date() },
    });

    const workflowId = await enqueueWorkflow(call.id, WorkflowType.CHECK_CUSTOMER, {
      email: 'a@b.com',
    });

    const completed = await waitFor(async () => {
      const w = await prisma.workflow.findUnique({ where: { id: workflowId } });
      return w?.status === 'completed' ? w : null;
    });

    expect(completed.output).toMatchObject({ success: true });
    expect((completed.output as any).customer.email).toBe('a@b.com');
  });

  it('is idempotent: same (callId, type, args) returns the same workflowId', async () => {
    const call = await prisma.call.create({
      data: { id: '00000000-0000-0000-0000-000000000002', status: 'active', startedAt: new Date() },
    });

    const a = await enqueueWorkflow(call.id, WorkflowType.CREATE_TICKET, {
      description: 'router down',
      priority: 'high',
    });
    const b = await enqueueWorkflow(call.id, WorkflowType.CREATE_TICKET, {
      priority: 'high',
      description: 'router down',
    });

    expect(a).toBe(b);
    const count = await prisma.workflow.count({ where: { callId: call.id } });
    expect(count).toBe(1);

    // Let the worker drain the one queued job before the next test's
    // beforeEach truncates rows out from under it.
    await waitFor(async () => {
      const w = await prisma.workflow.findUnique({ where: { id: a } });
      return w && (w.status === 'completed' || w.status === 'failed') ? w : null;
    });
  });

  it('persists failure when an activity throws past max retries', async () => {
    const call = await prisma.call.create({
      data: { id: '00000000-0000-0000-0000-000000000003', status: 'active', startedAt: new Date() },
    });

    // createTicket's Zod schema requires `description`. Passing an object
    // without it makes the activity throw on every attempt, exercising the
    // real BullMQ retry + persist-failed path.
    const workflowId = await enqueueWorkflow(call.id, WorkflowType.CREATE_TICKET, {
      priority: 'high',
    });

    const failed = await waitFor(
      async () => {
        const w = await prisma.workflow.findUnique({ where: { id: workflowId } });
        return w?.status === 'failed' ? w : null;
      },
      { timeoutMs: 15_000 },
    );

    expect(failed.error).toMatch(/description/i);
    expect(failed.retryCount).toBeGreaterThanOrEqual(2);
  });
});
