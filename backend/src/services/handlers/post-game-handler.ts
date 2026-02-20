/**
 * Post-Game Action Handler
 * Validates post-game action and maps action to effect type
 *
 * ARCHITECTURE: Business logic layer
 * - Validates payload, connection, room context
 * - Maps action → effect (execute_punishment → stamp_death, etc.)
 * - Returns result for controller to broadcast to ALL room participants
 */

import type { ConnectionManager } from '../websocket/connection-manager';
import type { IPostGameActionMessage } from '../../types/websocket';
import { PostGameActionSchema } from '../../models/schemas/post-game-message.schema';
import { EWSErrorCode } from '../../types/websocket';
import {
    validatePayload,
    validateConnection,
    validateRoomParticipant,
} from './handler-utils';

/** Map client action names to broadcast effect types */
const ACTION_TO_EFFECT: Record<string, 'stamp_death' | 'beg_emoji'> = {
    execute_punishment: 'stamp_death',
    beg_for_mercy: 'beg_emoji',
};

export interface IPostGameActionResult {
    success: true;
    roomId: string;
    effect: 'stamp_death' | 'beg_emoji';
    fromUserId: string;
    remainingCount: number;
}

export interface IPostGameActionError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TPostGameActionHandlerResult =
    | IPostGameActionResult
    | IPostGameActionError;

export function handlePostGameAction(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IPostGameActionMessage
): TPostGameActionHandlerResult {
    // Validate payload schema
    const v = validatePayload(PostGameActionSchema, message.data);
    if (!v.success) return v;

    const { roomId, action, remainingCount } = v.data;

    // Validate connection
    const conn = validateConnection(connectionManager, connectionId);
    if (!conn.success) return conn;

    // Verify roomId matches connection's roomId
    if (conn.roomId !== roomId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'roomId must match your current room',
        };
    }

    // Validate room + participant (no status check — verdict phase)
    const roomResult = validateRoomParticipant(roomId, conn.userId);
    if (!roomResult.success) return roomResult;

    const effect = ACTION_TO_EFFECT[action];

    console.log(
        `[POST_GAME] ${conn.userId} triggered ${action} → ${effect} in room ${roomId}`
    );

    return {
        success: true,
        roomId,
        effect,
        fromUserId: conn.userId,
        remainingCount,
    };
}
