/**
 * Verdict Retry Handler
 * Handles VERDICT_RETRY messages to retry failed verdict generation
 */

import { VERDICT_CONFIG } from '../../constants/config';
import { EWSErrorCode } from '../../types/websocket';
import type { IVerdictRetryMessage } from '../../types/websocket/verdict';
import { VerdictRetryDataSchema } from '../../models/schemas/verdict-message.schema';
import { validatePayload, validateRoomParticipant } from './handler-utils';

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
    const v = validatePayload(VerdictRetryDataSchema, message.data);
    if (!v.success) return v;

    const { roomId, userId } = v.data;

    // 2. Validate room + participant
    const roomResult = validateRoomParticipant(roomId, userId);
    if (!roomResult.success) return roomResult;

    const { room } = roomResult;

    // 3. Check retry count
    const retryCount = room.verdictRetryCount || 0;
    if (retryCount >= VERDICT_CONFIG.MAX_RETRIES) {
        console.log(
            `[VERDICT_RETRY] Max retries reached ` + `for room ${roomId}`
        );
        return {
            success: true,
            roomId,
            userId,
            canRetry: false,
        };
    }

    // 4. Reset status to allow retry
    room.verdictStatus = 'pending';

    console.log(
        `[VERDICT_RETRY] Retry requested for ` +
            `room ${roomId} (attempt ` +
            `${retryCount + 1}/${VERDICT_CONFIG.MAX_RETRIES})`
    );

    return {
        success: true,
        roomId,
        userId,
        canRetry: true,
    };
}
