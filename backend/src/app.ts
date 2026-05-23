import cors from 'cors';
import express, { Express } from 'express';
import { requestLogger } from './api/middleware/requestLogger';
import { metricsMiddleware } from './api/middleware/metrics';
import { errorHandler } from './api/middleware/errorHandler';
import apiRouter from './api/routes';

export function createApp(): Express {
  const app = express();
  app.use(cors({ exposedHeaders: ['x-request-id'] }));
  app.use(express.json());
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}
