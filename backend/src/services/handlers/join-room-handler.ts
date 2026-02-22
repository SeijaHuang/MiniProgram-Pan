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

    const { roomCode, user } = v.data;

    // Check if user is already a participant (e.g., room creator)
    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    const isAlreadyParticipant = room.participants.some(
        p => p.user.userId === user.userId
    );

    let finalRoom = room;

    if (isAlreadyParticipant) {
        // User is already a participant, just bind the WebSocket connection
        logger.log(
            'JoinRoom',
            `User ${user.userId} is already a participant, binding WebSocket connection`
        );
    } else {
        // User is not a participant, try to join
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

        finalRoom = result.room;
    }

    // Bind connection to user and room
    connectionManager.bindConnection(
        connectionId,
        user.userId,
        finalRoom.roomId
    );

    logger.log(
        'JoinRoom',
        `User ${user.userId} connected to room ${finalRoom.roomId} (${finalRoom.participants.length}/2)`
    );

    return {
        success: true,
        room: finalRoom,
    };
}
