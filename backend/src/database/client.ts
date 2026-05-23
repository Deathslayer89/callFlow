import { PrismaClient } from '@prisma/client';
import logger from '@callflow/shared/logger';

export const prisma = new PrismaClient({ log: ['error', 'warn'] });

const shutdown = async () => {
  logger.info('Disconnecting from database');
  await prisma.$disconnect();
};

process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
