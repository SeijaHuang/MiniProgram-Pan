/**
 * Verdict HTTP Controller
 * HTTP endpoint for retrieving cached verdict results
 *
 * ARCHITECTURE: Controller layer
 * - Provides fallback HTTP access to verdict results
 * - Used when WebSocket connection is lost
 * - Returns cached verdict only (does not trigger generation)
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { roomManager } from '../services/websocket/room-manager';

/**
 * Path parameter validation schema
 */
const RoomIdParamSchema = z.object({
    roomId: z.string().min(1, 'roomId is required'),
});

export class VerdictHttpController {
    /**
     * GET /v1/rooms/:roomId/verdict
     * Retrieve cached verdict result for a room
     *
     * @param req - Express request
     * @param res - Express response
     */
    static getVerdict(req: Request, res: Response): void {
        try {
            // 1. Validate path parameter
            const paramValidation = RoomIdParamSchema.safeParse(req.params);
            if (!paramValidation.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid roomId parameter',
                    details: paramValidation.error.errors,
                });
                return;
            }

            const { roomId } = paramValidation.data;

            // 2. Get room
            const room = roomManager.getRoomById(roomId);
            if (!room) {
                res.status(404).json({
                    success: false,
                    error: 'Room not found',
                });
                return;
            }

            // 3. Check if verdict is completed
            if (room.verdictStatus !== 'completed' || !room.verdictResult) {
                res.status(404).json({
                    success: false,
                    error: 'Verdict not ready',
                    status: room.verdictStatus || 'pending',
                });
                return;
            }

            // 4. Return cached verdict
            res.status(200).json({
                success: true,
                data: room.verdictResult,
            });
        } catch (error) {
            console.error('[VerdictHttpController] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
}
