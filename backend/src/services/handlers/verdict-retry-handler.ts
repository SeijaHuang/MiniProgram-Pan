/**
 * Verdict Retry Handler
 * Handles VERDICT_RETRY messages to retry failed verdict generation
 */

import { roomManager } from '../websocket/room-manager';
import { VerdictRetryDataSchema } from '../../models/schemas/verdict-message.schema';
import { VERDICT_CONFIG } from '../../constants/config';
import { EWSErrorCode } from '../../types/websocket';
import type { IVerdictRetryMessage } from '../../types/websocket/verdict';

/**
 * Handler result type
 */
export type TVerdictRetryHandlerResult =
    | {
          success: true;
          roomId: string;
          userId: string;
          canRetry: boolean;
      }
    | {
          success: false;
          code: EWSErrorCode;
          message: string;
      };

/**
 * Handle VERDICT_RETRY message
 * Allows users to retry failed verdict generation
 *
 * @param message - The VERDICT_RETRY message
 * @returns Handler result with canRetry flag
 */
export function handleVerdictRetry(
    message: IVerdictRetryMessage
): TVerdictRetryHandlerResult {
    // 1. Validate payload
    const validation = VerdictRetryDataSchema.safeParse(message.data);
    if (!validation.success) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: `Invalid VERDICT_RETRY payload: ${validation.error.message}`,
        };
    }

    const { roomId, userId } = validation.data;

    // 2. Get room
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return {
            success: false,
            code: EWSErrorCode.RoomNotFound,
            message: 'Room not found',
        };
    }

    // 3. Verify user is a participant
    const isParticipant = room.participants.some(p => p.user.userId === userId);
    if (!isParticipant) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'User is not a participant in this room',
        };
    }

    // 4. Check retry count
    const retryCount = room.verdictRetryCount || 0;
    if (retryCount >= VERDICT_CONFIG.MAX_RETRIES) {
        console.log(`[VERDICT_RETRY] Max retries reached for room ${roomId}`);
        return {
            success: true,
            roomId,
            userId,
            canRetry: false,
        };
    }

    // 5. Reset status to allow retry
    room.verdictStatus = 'pending';

    console.log(
        `[VERDICT_RETRY] Retry requested for room ${roomId} (attempt ${retryCount + 1}/${VERDICT_CONFIG.MAX_RETRIES})`
    );

    return {
        success: true,
        roomId,
        userId,
        canRetry: true,
    };
}
