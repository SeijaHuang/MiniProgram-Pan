/**
 * Speech Turn End Handler
 * Handles SPEECH_TURN_END messages when a player finishes their speech
 */

import { EWSErrorCode } from '../../types/websocket';
import type { ISpeechTurnEndMessage } from '../../types/websocket/verdict';
import { SpeechTurnEndDataSchema } from '../../models/schemas/verdict-message.schema';
import { validatePayload, validateRoomParticipant } from './handler-utils';
import { logger } from '../../utils/logger';

/**
 * Handler result type
 */
export type TSpeechTurnEndHandlerResult =
    | {
          success: true;
          roomId: string;
          userId: string;
          bothFinished: boolean;
          nextSpeakerUserId?: string;
      }
    | {
          success: false;
          code: EWSErrorCode;
          message: string;
      };

/**
 * Handle SPEECH_TURN_END message
 * Marks a player's speech turn as finished
 *
 * @param message - The SPEECH_TURN_END message
 * @returns Handler result with bothFinished flag
 */
export function handleSpeechTurnEnd(
    message: ISpeechTurnEndMessage
): TSpeechTurnEndHandlerResult {
    // 1. Validate payload
    const v = validatePayload(SpeechTurnEndDataSchema, message.data);
    if (!v.success) return v;

    const { roomId, userId } = v.data;

    // 2. Validate room + participant
    const roomResult = validateRoomParticipant(roomId, userId);
    if (!roomResult.success) return roomResult;

    const { room } = roomResult;

    // 3. Initialize speech state if needed
    if (!room.speechState) {
        room.speechState = {
            texts: {},
            finished: {},
        };
    }

    // 4. Mark user's turn as finished
    room.speechState.finished[userId] = true;

    logger.log(
        'SpeechTurnEnd',
        `User ${userId} finished speaking in room ${roomId}`
    );

    // 5. Check if both finished
    const participantIds = room.participants.map(p => p.user.userId);
    const bothFinished = participantIds.every(
        uid => room.speechState!.finished[uid]
    );

    if (bothFinished) {
        logger.log('SpeechTurnEnd', `Both players finished in room ${roomId}`);
        return { success: true, roomId, userId, bothFinished: true };
    }

    // 6. Find next speaker (the one who hasn't finished yet)
    const nextSpeakerUserId = participantIds.find(
        uid => !room.speechState!.finished[uid]
    );

    return {
        success: true,
        roomId,
        userId,
        bothFinished: false,
        nextSpeakerUserId,
    };
}
