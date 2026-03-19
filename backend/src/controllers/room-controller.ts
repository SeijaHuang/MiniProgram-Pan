/**
 * Room Controller
 * Handles HTTP requests for room management
 *
 * ARCHITECTURE: Controller layer
 * - Validates HTTP request
 * - Calls business logic (service layer)
 * - Formats HTTP response
 * - Does NOT contain business logic
 */

import type { Request, Response } from 'express';
import type { IBaseResponse, ICreateRoomResponseData } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import { roomService } from '../services/core/room/room.service';
import { CreateRoomRequestSchema } from '../models/schemas/http-request.schema';
import { logger } from '../utils/logger';

export class RoomController {
    /**
     * Create a new room
     * POST /v1/rooms
     */
    static createRoom(req: Request<unknown, unknown>, res: Response): void {
        try {
            // Validate request body with Zod
            const validation = CreateRoomRequestSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.issues;
                const errorMessage = errors[0]?.message ?? 'Invalid request';
                const response: IBaseResponse<never> = {
                    success: false,
                    error: {
                        code: EHttpErrorCode.InvalidRequest,
                        message: errorMessage,
                    },
                };
                res.status(400).json(response);
                return;
            }

            const room = roomService.createRoom();

            const response: IBaseResponse<ICreateRoomResponseData> = {
                success: true,
                data: { room },
            };

            res.status(201).json(response);
        } catch (error: unknown) {
            logger.error('RoomController', 'Room creation failed:', error);

            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.RoomCreateFailed,
                    message: errorMessage,
                },
            };

            res.status(500).json(response);
        }
    }
}
