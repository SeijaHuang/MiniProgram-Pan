/**
 * Shared Handler Validation Utilities
 * Extracts common validation patterns used across handlers
 *
 * ARCHITECTURE: Shared utilities for the business logic layer
 * - Schema validation (Zod)
 * - Connection lookup
 * - Room lookup + participant verification
 * - Room status checks
 */

import type { ZodSchema, ZodTypeDef } from 'zod';
import { EWSErrorCode } from '../../types/websocket';
import type { IRoom, IParticipant } from '../../models/entities/room';
import { ERoomStatus } from '../../models/entities/room';
import { roomManager } from '../websocket/room-manager';
import type { ConnectionManager } from '../websocket/connection-manager';

/**
 * Common error shape returned by all handlers
 */
export interface IHandlerError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

/**
 * Validate a message payload against a Zod schema.
 * Returns parsed data on success, or IHandlerError on failure.
 */
export function validatePayload<T>(
    schema: ZodSchema<T, ZodTypeDef, unknown>,
    data: unknown
): { success: true; data: T } | IHandlerError {
    const validation = schema.safeParse(data);
    if (!validation.success) {
        const firstError = validation.error.issues[0];
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: firstError?.message ?? 'Invalid payload',
        };
    }
    return { success: true, data: validation.data };
}

/**
 * Validate that a connection exists and is bound to a user/room.
 * Returns userId + roomId on success, or IHandlerError on failure.
 */
export function validateConnection(
    connMgr: ConnectionManager,
    connectionId: string
): { success: true; userId: string; roomId: string } | IHandlerError {
    const connectionData = connMgr.getConnection(connectionId);
    if (!connectionData || !connectionData.userId || !connectionData.roomId) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You must join a room first',
        };
    }
    return {
        success: true,
        userId: connectionData.userId,
        roomId: connectionData.roomId,
    };
}

/**
 * Validate room exists and user is a participant (no status check).
 * Used by speech-turn-end, verdict-retry.
 */
export function validateRoomParticipant(
    roomId: string,
    userId: string
): { success: true; room: IRoom; participant: IParticipant } | IHandlerError {
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    const participant = room.participants.find(p => p.user.userId === userId);
    if (!participant) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

    return { success: true, room, participant };
}

/**
 * Validate room exists, status is READY, and user is a participant.
 * Used by chat-send, asr-text, emoji-text.
 */
export function validateReadyRoomParticipant(
    roomId: string,
    userId: string
): { success: true; room: IRoom; participant: IParticipant } | IHandlerError {
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    if (room.status !== ERoomStatus.Ready) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotReady,
            message: 'Room is not ready for chat (need 2 participants)',
        };
    }

    const participant = room.participants.find(p => p.user.userId === userId);
    if (!participant) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

    return { success: true, room, participant };
}

/**
 * Validate connection + ready room + participant in one call.
 * Combines validateConnection + validateReadyRoomParticipant.
 * Used by chat-send (handlers that don't need ID mismatch checks).
 */
export function validateRoomContext(
    connMgr: ConnectionManager,
    connectionId: string
):
    | {
          success: true;
          userId: string;
          roomId: string;
          room: IRoom;
          participant: IParticipant;
      }
    | IHandlerError {
    const connResult = validateConnection(connMgr, connectionId);
    if (!connResult.success) return connResult;

    const roomResult = validateReadyRoomParticipant(
        connResult.roomId,
        connResult.userId
    );
    if (!roomResult.success) return roomResult;

    return {
        success: true,
        userId: connResult.userId,
        roomId: connResult.roomId,
        room: roomResult.room,
        participant: roomResult.participant,
    };
}
