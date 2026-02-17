/**
 * Speech Turn End Handler
 * Handles SPEECH_TURN_END messages when a player finishes their speech
 */

import { EWSErrorCode } from '../../types/websocket';
import type { ISpeechTurnEndMessage } from '../../types/websocket/verdict';
import { SpeechTurnEndDataSchema } from '../../models/schemas/verdict-message.schema';
import { validatePayload, validateRoomParticipant } from './handler-utils';

/**
 * Handler result type
 */
export type TSpeechTurnEndHandlerResult =
    | {
          success: true;
          roomId: string;
          userId: string;
          bothFinished: boolean;
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
            hostText: '',
            guestText: '',
            hostFinished: false,
            guestFinished: false,
        };
    }

    // 4. Mark user's turn as finished
    const isHost = userId === room.hostUserId;
    if (isHost) {
        room.speechState.hostFinished = true;
    } else {
        room.speechState.guestFinished = true;
    }

    console.log(
        `[SPEECH_TURN_END] ` +
            `${isHost ? 'Host' : 'Guest'} finished ` +
            `speaking in room ${roomId}`
    );

    // 5. Check if both finished
    const bothFinished =
        room.speechState.hostFinished && room.speechState.guestFinished;

    if (bothFinished) {
        console.log(
            `[SPEECH_TURN_END] Both players ` + `finished in room ${roomId}`
        );
    }

    return {
        success: true,
        roomId,
        userId,
        bothFinished,
    };
}
