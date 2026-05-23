import dotenv from 'dotenv';
import { workflowWorker } from './workers/workflowWorker';
import { prisma } from './db';
import logger from '@callflow/shared/logger';

dotenv.config();

logger.info('worker.start');

const SHUTDOWN_TIMEOUT_MS = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 30_000);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) {
    logger.warn('worker.shutdown.forced', { signal });
    process.exit(1);
  }
  shuttingDown = true;
  logger.info('worker.shutdown.start', { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });

  const timer = setTimeout(() => {
    logger.error('worker.shutdown.timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    await workflowWorker.close();
    await prisma.$disconnect();
    logger.info('worker.shutdown.done');
    process.exit(0);
  } catch (err) {
    logger.error('worker.shutdown.error', { err });
    process.exit(1);
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('worker.uncaughtException', { err });
  void shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) =>
  logger.error('worker.unhandledRejection', { reason }),
);
