import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { AccessToken } from 'livekit-server-sdk';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireApiKey } from '../middleware/apiKey';
import { AppError, NotFound } from '../errors';
import { prisma } from '../../database/client';
import { config } from '../../config';

const router = Router();

const tokenParamsSchema = z.object({
  id: z.string().uuid(),
});

const tokenBodySchema = z.object({
  identity: z.string().min(1),
  name: z.string().optional(),
});

const tokenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many token requests' } },
});

router.post(
  '/:id/token',
  tokenLimiter,
  requireApiKey,
  asyncHandler(async (req, res) => {
    if (!config.livekit.apiKey || !config.livekit.apiSecret) {
      throw new AppError(
        500,
        'LIVEKIT_NOT_CONFIGURED',
        'LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set',
      );
    }

    const { id } = tokenParamsSchema.parse(req.params);
    const body = tokenBodySchema.parse(req.body);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) throw NotFound('call', id);

    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: body.identity,
      name: body.name,
      ttl: 60 * 60, // 1 hour
    });
    at.addGrant({
      roomJoin: true,
      room: id,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({
      success: true,
      data: {
        token,
        url: config.livekit.url,
        room: id,
      },
    });
  }),
);

export default router;
