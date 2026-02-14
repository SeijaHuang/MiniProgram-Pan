/**
 * Speech Turn End Handler
 * Handles SPEECH_TURN_END messages when a player finishes their speech
 */

import { roomManager } from '../websocket/room-manager';
import { SpeechTurnEndDataSchema } from '../../models/schemas/verdict-message.schema';
import { EWSErrorCode } from '../../types/websocket';
import type { ISpeechTurnEndMessage } from '../../types/websocket/verdict';

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
    const validation = SpeechTurnEndDataSchema.safeParse(message.data);
    if (!validation.success) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: `Invalid SPEECH_TURN_END payload: ${validation.error.message}`,
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

    // 4. Initialize speech state if needed
    if (!room.speechState) {
        room.speechState = {
            hostText: '',
            guestText: '',
            hostFinished: false,
            guestFinished: false,
        };
    }

    // 5. Mark user's turn as finished
    const isHost = userId === room.hostUserId;
    if (isHost) {
        room.speechState.hostFinished = true;
    } else {
        room.speechState.guestFinished = true;
    }

    console.log(
        `[SPEECH_TURN_END] ${isHost ? 'Host' : 'Guest'} finished speaking in room ${roomId}`
    );

    // 6. Check if both finished
    const bothFinished =
        room.speechState.hostFinished && room.speechState.guestFinished;

    if (bothFinished) {
        console.log(
            `[SPEECH_TURN_END] Both players finished in room ${roomId}`
        );
    }

    return {
        success: true,
        roomId,
        userId,
        bothFinished,
    };
}
