import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAME, WorkflowJobData } from '../queue/client';
import { prisma } from '../db';
import { executeWorkflow } from '../workflows';
import logger from '@callflow/shared/logger';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export async function closeWorker(): Promise<void> {
  await workflowWorker.close();
  await connection.quit();
}

export const workflowWorker = new Worker<WorkflowJobData>(
  QUEUE_NAME,
  async (job: Job<WorkflowJobData>) => {
    const { workflowId, type, input, requestId } = job.data;
    const ctx = { workflowId, type, requestId, jobId: job.id };

    logger.info('worker.job.start', ctx);

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'running', startedAt: new Date(), retryCount: job.attemptsMade },
    });

    try {
      const output = await executeWorkflow(type, input);
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { status: 'completed', completedAt: new Date(), output: output as any },
      });

      // For ticket workflows, surface the created ticket id on the Call row
      // so the agent can read it back to the caller without scanning workflows.
      if (type === 'create_ticket') {
        const ticketId = (output as any)?.ticket?.id;
        if (typeof ticketId === 'string') {
          await prisma.call
            .update({ where: { id: job.data.callId }, data: { ticketId } })
            .catch((err) => logger.error('worker.call.update.failed', { err: err?.message }));
        }
      }

      logger.info('worker.job.done', ctx);
      return output;
    } catch (error: any) {
      // BullMQ retries until attemptsMade === attempts; only persist the
      // failed state on the final attempt.
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      logger.error('worker.job.error', { ...ctx, willRetry, error: error?.message });
      if (!willRetry) {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            error: error?.message ?? String(error),
          },
        });
      }
      throw error;
    }
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    limiter: { max: 10, duration: 1000 },
  },
);
