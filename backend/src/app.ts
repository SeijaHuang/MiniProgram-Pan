/**
 * Express HTTP Server
 * Configures Express app and routes
 *
 * ARCHITECTURE: Application setup
 * - Configures Express middleware
 * - Registers routes
 * - Does NOT contain business logic or route handlers
 */

import express, { Request, Response } from 'express';
import roomRoutes from './routes/room-routes';
import llmJudgementRoutes from './routes/llm-judgement.routes';
import tencentRoutes from './routes/tencent-routes';

const app = express();

// Parse JSON request bodies
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

/**
 * Room routes
 * /room/*
 */
app.use('/room', roomRoutes);

/**
 * LLM Judgement routes (v1 API)
 * POST /v1/rooms/:roomId/llm/judgement
 */
app.use('/v1', llmJudgementRoutes);

/**
 * Tencent routes
 * /tencent/*
 */
app.use('/tencent', tencentRoutes);

export default app;
