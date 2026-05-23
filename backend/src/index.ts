import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import logger from '@callflow/shared/logger';

const server = createServer(createApp());

server.listen(config.port, () => {
  logger.info('backend.listen', { port: config.port, env: config.nodeEnv });
});

const shutdown = () => {
  logger.info('backend.shutdown');
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
