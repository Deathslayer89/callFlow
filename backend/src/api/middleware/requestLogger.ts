import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@callflow/shared/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length <= 64 ? incoming : uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    logger.info('http.request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
};
