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
 * POST /v1/rooms
 */
app.use('/v1/rooms', roomRoutes);

/**
 * LLM Judgement routes
 * POST /v1/rooms/:roomId/judgments
 */
app.use('/v1/rooms', llmJudgementRoutes);

/**
 * Tencent routes
 * GET /v1/tencent/credentials
 */
app.use('/v1/tencent', tencentRoutes);

export default app;
