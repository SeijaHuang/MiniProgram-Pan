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
import llmRoutes from './routes/llm-routes';
import { prisma } from './database/prisma';

const app = express();

// Parse JSON request bodies
app.use(express.json());

/**
 * Health check endpoint
 * Includes database connectivity verification
 */
app.get('/health', async (_req: Request, res: Response) => {
    try {
        // Verify database connectivity by counting tasks
        const taskCount = await prisma.llmTask.count();
        res.json({
            ok: true,
            database: {
                connected: true,
                taskCount,
            },
        });
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'Unknown database error';
        res.status(503).json({
            ok: false,
            database: {
                connected: false,
                error: errorMessage,
            },
        });
    }
});

/**
 * Room routes
 * /room/*
 */
app.use('/room', roomRoutes);

/**
 * LLM routes (v1 API)
 * /v1/rooms/:roomId/llm/*
 * /v1/llm/*
 */
app.use('/v1', llmRoutes);

export default app;
