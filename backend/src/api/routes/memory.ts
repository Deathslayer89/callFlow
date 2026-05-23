import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireApiKey } from '../middleware/apiKey';
import { searchMemoryForCall } from '../../services/memory';

const router = Router();

const searchBody = z.object({
  callId: z.string().uuid(),
  query: z.string().nullish(),
});

router.post(
  '/search',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { callId, query } = searchBody.parse(req.body);
    const { email, memories } = await searchMemoryForCall(callId, query ?? undefined);
    res.json({ success: true, data: { email, memories } });
  }),
);

export default router;
