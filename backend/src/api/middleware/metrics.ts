import { Request, Response, NextFunction } from 'express';
import { httpRequests, httpDuration } from '../../observability/metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpDuration.observe(labels, seconds);
  });
  next();
};
