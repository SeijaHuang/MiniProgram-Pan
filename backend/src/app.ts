/**
 * Express HTTP Server
 * Handles HTTP API endpoints
 *
 * CRITICAL: Only room creation is handled via HTTP
 * CRITICAL: All real-time communication is via WebSocket
 */

import express, { type Request, type Response } from 'express';
import type {
    ICreateRoomRequest,
    IBaseResponse,
    ICreateRoomResponseData,
} from './types/http';
import { EHttpErrorCode } from './types/http';
import { roomManager } from './services/room-manager';

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
 * Create room endpoint
 * POST /room/create
 *
 * CRITICAL: This is the ONLY way to create a room
 * CRITICAL: Returns room with roomCode for joining
 */
app.post(
    '/room/create',
    (req: Request<unknown, unknown, ICreateRoomRequest>, res: Response) => {
        try {
            const { creator } = req.body;

            // Validate request
            if (!creator || !creator.userId || !creator.nickname) {
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message:
                            'creator.userId and creator.nickname are required',
                    },
                };
                res.status(400).json(response);
                return;
            }

            // Create room
            const room = roomManager.createRoom(creator);

            // Return success response
            const response: IBaseResponse<ICreateRoomResponseData> = {
                success: true,
                data: { room },
            };
            res.status(201).json(response);
        } catch (error) {
            console.error('[HTTP] Room creation failed:', error);
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.RoomCreateFailed,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
            };
            res.status(500).json(response);
        }
    }
);

export default app;
