/**
 * Express HTTP Server
 * Configures Express app and routes
 *
 * ARCHITECTURE: Application setup
 * - Configures Express middleware
 * - Registers routes
 * - Does NOT contain business logic or route handlers
 */

import express from 'express';
import roomRoutes from './routes/room-routes';
import tencentRoutes from './routes/tencent-routes';

const app = express();

// Parse JSON request bodies
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});

/**
 * Room routes
 * /room/*
 */
app.use('/room', roomRoutes);

/**
 * Tencent routes
 * /tencent/*
 */
app.use('/tencent', tencentRoutes);

export default app;
