import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { AppError } from '../errors';

export const requireApiKey = (req: Request, _res: Response, next: NextFunction) => {
  if (!config.apiKey) return next();
  const provided = req.header('x-api-key');
  if (provided !== config.apiKey) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or missing API key'));
  }
  next();
};
