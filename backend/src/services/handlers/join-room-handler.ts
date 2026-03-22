/**
 * JOIN_ROOM Business Logic Handler
 * Handles room join business logic
 *
 * ARCHITECTURE: Business logic layer
 * - Validates join preconditions
 * - Calls domain services (RoomManager, ConnectionManager)
 * - Returns result (success/error)
 * - Does NOT format or send WebSocket messages
 */

import { randomUUID } from 'crypto';

import type { IJoinRoomMessage } from '../../types/websocket';
import { EWSErrorCode } from '../../types/websocket';
import { roomManager } from '../websocket/room-manager';
import type { ConnectionManager } from '../websocket/connection-manager';
import type { IRoom } from '../../models/entities/room';
import { JoinRoomDataSchema } from '../../models/schemas/ws-message.schema';
import { validatePayload } from './handler-utils';
import { logger } from '../../utils/logger';

export interface IJoinRoomResult {
    success: true;
    room: IRoom;
    userId: string;
}

export interface IJoinRoomError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TJoinRoomHandlerResult = IJoinRoomResult | IJoinRoomError;

export function handleJoinRoom(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IJoinRoomMessage
): TJoinRoomHandlerResult {
    // Validate payload schema
    const v = validatePayload(JoinRoomDataSchema, message.data);
    if (!v.success) return v;

    const { roomCode, nickname } = v.data;

    // Generate a new UUID for this user
    const userId = randomUUID();
    const user = { userId, nickname };

    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    // Try to join room
    const result = roomManager.joinRoom(roomCode, user);

    if (!result.success) {
        // Map domain errors to WebSocket error codes
        const errorCodeMap: Record<string, EWSErrorCode> = {
            ROOM_NOT_FOUND: EWSErrorCode.RoomNotFound,
            ROOM_CLOSED: EWSErrorCode.RoomClosed,
            ROOM_FULL: EWSErrorCode.RoomFull,
            ALREADY_JOINED: EWSErrorCode.AlreadyJoined,
        };

        const errorCode =
            errorCodeMap[result.error] || EWSErrorCode.InternalError;

        return {
            success: false,
            code: errorCode,
            message: result.error,
        };
    }

    // Bind connection to user and room
    connectionManager.bindConnection(connectionId, userId, result.room.roomId);

    logger.log(
        'JoinRoom',
        `User ${userId} connected to room ${result.room.roomId} (${result.room.participants.length}/2)`
    );

    return {
        success: true,
        room: result.room,
        userId,
    };
}
