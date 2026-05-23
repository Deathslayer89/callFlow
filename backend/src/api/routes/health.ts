import { Router } from 'express';
import { Redis } from 'ioredis';
import { prisma } from '../../database/client';
import { config } from '../../config';
import { registry } from '../../observability/metrics';

const router = Router();

const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

router.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'down'> = { postgres: 'down', redis: 'down' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    // leave 'down'
  }

  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'down';
  } catch {
    // leave 'down'
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});

router.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

export default router;
