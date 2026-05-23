import { Router } from 'express';
import callsRouter from './calls';
import chatRouter from './chat';
import livekitRouter from './livekit';
import healthRouter from './health';
import memoryRouter from './memory';

const router = Router();

router.use(healthRouter);
router.use('/calls', callsRouter);
router.use('/calls', livekitRouter);
router.use('/chat', chatRouter);
router.use('/memory', memoryRouter);

export default router;
