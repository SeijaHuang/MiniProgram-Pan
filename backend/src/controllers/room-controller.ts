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
import type {
    ICreateRoomRequest,
    IBaseResponse,
    ICreateRoomResponseData,
} from '../types/http';
import { EHttpErrorCode } from '../types/http';
import { roomService } from '../services/core/room/room.service';

export class RoomController {
    /**
     * Create a new room
     * POST /room/create
     */
    static createRoom(
        req: Request<unknown, unknown, ICreateRoomRequest>,
        res: Response
    ): void {
        try {
            const room = roomService.createRoom();

            const response: IBaseResponse<ICreateRoomResponseData> = {
                success: true,
                data: { room },
            };

            res.status(201).json(response);
        } catch (error) {
            console.error('[RoomController] Room creation failed:', error);

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
}
