import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RoomServiceClient } from 'livekit-server-sdk';
import { enqueueWorkflow } from '@callflow/workflows';
import { WorkflowType } from '@callflow/shared';
import { prisma } from '../../database/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireApiKey } from '../middleware/apiKey';
import { NotFound } from '../errors';
import { callsStarted } from '../../observability/metrics';
import { config } from '../../config';
import logger from '@callflow/shared/logger';

let roomService: RoomServiceClient | null = null;
function getRoomService(): RoomServiceClient | null {
  if (roomService) return roomService;
  if (!config.livekit.url || !config.livekit.apiKey || !config.livekit.apiSecret) return null;
  const httpUrl = config.livekit.url.replace(/^wss?:/, 'https:');
  roomService = new RoomServiceClient(httpUrl, config.livekit.apiKey, config.livekit.apiSecret);
  return roomService;
}

const router = Router();

const startCallSchema = z.object({
  phoneNumber: z.string().optional(),
  userId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const endCallSchema = z.object({
  callId: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['pending', 'active', 'completed', 'failed']).optional(),
});

router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const body = startCallSchema.parse(req.body);
    const call = await prisma.call.create({
      data: {
        id: uuidv4(),
        phoneNumber: body.phoneNumber,
        userId: body.userId,
        status: 'active',
        startedAt: new Date(),
        metadata: body.metadata ?? {},
      },
    });
    callsStarted.inc({ source: body.phoneNumber ? 'phone' : 'web' });
    logger.info('call.started', { callId: call.id, requestId: req.requestId });
    res.json({ success: true, data: call });
  }),
);

router.post(
  '/end',
  asyncHandler(async (req, res) => {
    const { callId } = endCallSchema.parse(req.body);
    const existing = await prisma.call.findUnique({ where: { id: callId } });
    if (!existing) throw NotFound('call', callId);

    const endedAt = new Date();
    const duration = Math.floor((endedAt.getTime() - existing.startedAt.getTime()) / 1000);
    const call = await prisma.call.update({
      where: { id: callId },
      data: { status: 'completed', endedAt, duration },
    });

    // Delete the LiveKit room so the browser's onDisconnected fires and it
    // navigates off the voice page. Without this, ctx.shutdown() only kicks
    // the agent — the caller's tab stays connected to an empty room.
    const svc = getRoomService();
    if (svc) {
      svc.deleteRoom(callId).catch((err) => {
        logger.warn('livekit.deleteRoom failed', { callId, err: err?.message });
      });
    }

    // Fire-and-forget the memory write. The worker reads messages, summarises,
    // and stores in mem0 keyed on callerEmail. Skipped server-side if there's
    // no email on the call.
    if (call.callerEmail) {
      enqueueWorkflow(callId, WorkflowType.SUMMARIZE_CALL, { callId }).catch((err) =>
        logger.warn('memory.enqueue.failed', { callId, err: err?.message }),
      );
    }

    logger.info('call.ended', { callId, duration, requestId: req.requestId });
    res.json({ success: true, data: call });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { timestamp: 'asc' } },
        transcripts: { orderBy: { createdAt: 'asc' } },
        workflows: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!call) throw NotFound('call', req.params.id);
    res.json({ success: true, data: call });
  }),
);

const messageBodySchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  source: z.enum(['voice', 'chat']).default('voice'),
});

router.post(
  '/:id/messages',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = messageBodySchema.parse(req.body);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) throw NotFound('call', id);

    const message = await prisma.message.create({
      data: { id: uuidv4(), callId: id, role: body.role, content: body.content,
        metadata: { source: body.source } },
    });
    res.json({ success: true, data: message });
  }),
);

const callerEmailSchema = z.object({ email: z.string().email() });

router.post(
  '/:id/email',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { email } = callerEmailSchema.parse(req.body);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) throw NotFound('call', id);

    const user = await prisma.user.upsert({
      where: { email },
      create: { email },
      update: {},
    });
    const updated = await prisma.call.update({
      where: { id },
      data: { callerEmail: email, userId: user.id },
    });
    logger.info('call.email.recorded', {
      callId: id,
      userId: user.id,
      requestId: req.requestId,
    });
    res.json({ success: true, data: updated });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, status } = listQuerySchema.parse(req.query);
    const where = status ? { status } : {};
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: { _count: { select: { messages: true, transcripts: true } } },
      }),
      prisma.call.count({ where }),
    ]);

    res.json({
      success: true,
      data: calls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

export default router;
