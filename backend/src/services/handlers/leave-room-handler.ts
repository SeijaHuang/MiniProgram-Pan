/**
 * Leave Room Handler
 * Handles LEAVE_ROOM messages — marks participant as left
 */

import { EWSErrorCode } from '../../types/websocket';
import type { ILeaveRoomMessage } from '../../types/websocket/verdict';
import { LeaveRoomDataSchema } from '../../models/schemas/verdict-message.schema';
import type { ConnectionManager } from '../websocket/connection-manager';
import { validatePayload, validateConnection } from './handler-utils';
import { roomManager } from '../websocket/room-manager';

/**
 * Handler result type
 */
export type TLeaveRoomHandlerResult =
    | {
          success: true;
          roomId: string;
          allLeft: boolean;
      }
    | {
          success: false;
          code: EWSErrorCode;
          message: string;
      };

/**
 * Handle LEAVE_ROOM message
 * Marks the participant's leftAt timestamp and checks if all left
 *
 * @param connMgr - Connection manager instance
 * @param connectionId - The connection ID of the sender
 * @param message - The LEAVE_ROOM message
 * @returns Handler result with allLeft flag
 */
export function handleLeaveRoom(
    connMgr: ConnectionManager,
    connectionId: string,
    message: ILeaveRoomMessage
): TLeaveRoomHandlerResult {
    // 1. Validate payload
    const v = validatePayload(LeaveRoomDataSchema, message.data);
    if (!v.success) return v;

    const { roomId } = v.data;

    // 2. Validate connection is bound
    const connResult = validateConnection(connMgr, connectionId);
    if (!connResult.success) return connResult;

    // 3. Find room
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    // 4. Find participant and mark leftAt
    const participant = room.participants.find(
        p => p.user.userId === connResult.userId
    );
    if (!participant) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

    participant.leftAt = Date.now();

    console.log(`[LEAVE_ROOM] User ${connResult.userId} left room ${roomId}`);

    // 5. Check if all participants have left
    const allLeft: boolean = room.participants.every(
        p => p.leftAt !== undefined
    );

    if (allLeft) {
        console.log(`[LEAVE_ROOM] All participants left room ${roomId}`);
    }

    return {
        success: true,
        roomId,
        allLeft,
    };
}
