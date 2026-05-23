import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/** Forward rejected promises to Express's error pipeline instead of crashing the process. */
export const asyncHandler =
  (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
