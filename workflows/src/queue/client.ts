import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { WorkflowType } from '@callflow/shared';
import logger from '@callflow/shared/logger';
import { computeIdempotencyKey } from '../idempotency';

export const QUEUE_NAME = 'workflows';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export interface WorkflowJobData {
  workflowId: string;
  callId: string;
  type: WorkflowType;
  input: unknown;
  requestId?: string;
}

export const workflowQueue = new Queue<WorkflowJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const workflowQueueEvents = new QueueEvents(QUEUE_NAME, { connection });

workflowQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Workflow job failed', { jobId, failedReason });
});

// Closes everything this package owns: the queue, queue-events, the Redis
// connection backing them, and the package-local Prisma client.
export async function closeWorkflowResources(): Promise<void> {
  await workflowQueueEvents.close();
  await workflowQueue.close();
  await connection.quit();
  await prisma.$disconnect();
}

export type EnqueueAndAwaitResult = {
  workflowId: string;
  output: unknown;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
};

// Enqueues a workflow AND blocks until it completes (or the timeout expires).
// Use this for tools that need the result in the same conversational turn —
// the LLM only sees what the tool returns, so async-only patterns leave it
// stuck with `{status: 'queued'}` and no way to read the actual output.
export async function enqueueAndAwaitWorkflow(
  callId: string,
  type: WorkflowType,
  input: unknown,
  options: { requestId?: string; timeoutMs?: number } = {},
): Promise<EnqueueAndAwaitResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const workflowId = await enqueueWorkflow(callId, type, input, options);

  // Idempotency may have returned an existing row that's already finished —
  // skip the wait in that case.
  const existing = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { status: true, output: true, error: true },
  });
  if (existing?.status === 'completed') {
    return { workflowId, output: existing.output, status: 'completed' };
  }
  if (existing?.status === 'failed') {
    return { workflowId, output: null, status: 'failed', error: existing.error ?? undefined };
  }

  const job = await workflowQueue.getJob(workflowId);
  if (!job) {
    return { workflowId, output: null, status: 'timeout' };
  }

  try {
    const output = await job.waitUntilFinished(workflowQueueEvents, timeoutMs);
    return { workflowId, output, status: 'completed' };
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (/timed out|timeout/i.test(msg)) {
      return { workflowId, output: null, status: 'timeout' };
    }
    return { workflowId, output: null, status: 'failed', error: msg };
  }
}

export async function enqueueWorkflow(
  callId: string,
  type: WorkflowType,
  input: unknown,
  options: { requestId?: string } = {},
): Promise<string> {
  const idempotencyKey = computeIdempotencyKey(callId, type, input);

  const dedup = await prisma.workflow.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (dedup) {
    logger.info('workflow.dedup', { workflowId: dedup.id, requestId: options.requestId });
    return dedup.id;
  }

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) {
    await prisma.call.create({
      data: {
        id: callId,
        status: 'active',
        startedAt: new Date(),
        metadata: { source: 'auto-created-by-workflow' },
      },
    });
  }

  let workflowId: string;
  try {
    const workflow = await prisma.workflow.create({
      data: {
        id: uuidv4(),
        callId,
        type,
        status: 'pending',
        idempotencyKey,
        input: input as any,
      },
    });
    workflowId = workflow.id;
  } catch (err: any) {
    // P2002 = unique violation; another concurrent caller won the race.
    if (err?.code !== 'P2002') throw err;
    const winner = await prisma.workflow.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (!winner) throw err;
    return winner.id;
  }

  await workflowQueue.add(
    type,
    { workflowId, callId, type, input, requestId: options.requestId },
    { jobId: workflowId },
  );

  logger.info('workflow.enqueued', { workflowId, callId, type, requestId: options.requestId });
  return workflowId;
}
