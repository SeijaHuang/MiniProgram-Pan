/**
 * ASR_TEXT_PUSH Business Logic Handler
 * Handles ASR text push business logic with deduplication and throttling
 *
 * ARCHITECTURE: Business logic layer
 * - Validates ASR text preconditions
 * - Manages seq deduplication
 * - Handles final state tracking
 * - Implements secondary throttling for partial messages
 * - Returns result (success/error)
 * - Does NOT format or send WebSocket messages directly
 */

import type { IASRTextPushMessage } from '../../types/websocket';
import { EWSErrorCode } from '../../types/websocket';
import type { ConnectionManager } from '../websocket/connection-manager';
import { ASRTextPushDataSchema } from '../../models/schemas/ws-asr-text-push.schema';
import {
    validatePayload,
    validateConnection,
    validateReadyRoomParticipant,
} from './handler-utils';
import { logger } from '../../utils/logger';

/**
 * ASR session state per speaker in a room
 * Tracks seq deduplication and final state
 */
interface IASRSessionState {
    /** Last processed sequence number */
    lastSeq: number;
    /** Whether final was received for current utterance */
    finalReceived: boolean;
    /** Pending partial message for throttling */
    pendingPartial: IASRTextPushMessage | null;
    /** Throttle timer ID */
    throttleTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Map key: `${roomId}:${speakerId}`
 */
const sessionStates = new Map<string, IASRSessionState>();

/**
 * Throttle interval for partial messages (ms)
 */
const PARTIAL_THROTTLE_MS = 200;

export interface IASRTextPushResult {
    success: true;
    roomId: string;
    speakerId: string;
    seq: number;
    text: string;
    isFinal: boolean;
    /** Whether to broadcast (false if throttled or deduplicated) */
    shouldBroadcast: boolean;
}

export interface IASRTextPushError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

export type TASRTextPushHandlerResult = IASRTextPushResult | IASRTextPushError;

/**
 * Get session key for a speaker in a room
 */
function getSessionKey(roomId: string, speakerId: string): string {
    return `${roomId}:${speakerId}`;
}

/**
 * Get or create session state
 */
function getOrCreateSessionState(
    roomId: string,
    speakerId: string
): IASRSessionState {
    const key = getSessionKey(roomId, speakerId);
    let state = sessionStates.get(key);
    if (!state) {
        state = {
            lastSeq: -1,
            finalReceived: false,
            pendingPartial: null,
            throttleTimer: null,
        };
        sessionStates.set(key, state);
    }
    return state;
}

/**
 * Reset session state for a new utterance
 */
function resetSessionState(roomId: string, speakerId: string): void {
    const key = getSessionKey(roomId, speakerId);
    const state = sessionStates.get(key);
    if (state) {
        if (state.throttleTimer) {
            clearTimeout(state.throttleTimer);
        }
        state.lastSeq = -1;
        state.finalReceived = false;
        state.pendingPartial = null;
        state.throttleTimer = null;
    }
}

/**
 * Handle ASR_TEXT_PUSH message
 *
 * @param connectionManager - Connection manager instance
 * @param connectionId - The connection ID of the sender
 * @param message - The ASR_TEXT_PUSH message
 * @param onThrottledBroadcast - Callback when a throttled partial should be broadcast
 */
export function handleASRTextPush(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: IASRTextPushMessage,
    onThrottledBroadcast?: (result: IASRTextPushResult) => void
): TASRTextPushHandlerResult {
    // 1. Validate payload schema
    const v = validatePayload(ASRTextPushDataSchema, message.data);
    if (!v.success) return v;

    const { roomId, speakerId, seq, text, isFinal } = v.data;

    // 2. Validate connection
    const conn = validateConnection(connectionManager, connectionId);
    if (!conn.success) return conn;

    // 3. Verify speakerId matches connection's userId
    if (conn.userId !== speakerId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'speakerId must match your userId',
        };
    }

    // 4. Verify roomId matches connection's roomId
    if (conn.roomId !== roomId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'roomId must match your current room',
        };
    }

    // 5. Validate room (READY) + participant
    const roomResult = validateReadyRoomParticipant(roomId, conn.userId);
    if (!roomResult.success) return roomResult;

    const { room } = roomResult;

    // 6. Get or create session state
    const state = getOrCreateSessionState(roomId, speakerId);

    // 7. Check if final was already received (ignore subsequent messages)
    if (state.finalReceived && seq <= state.lastSeq) {
        logger.log(
            'ASR',
            `Ignoring message after final (seq: ${seq}, lastSeq: ${state.lastSeq})`
        );
        return {
            success: true,
            roomId,
            speakerId,
            seq,
            text,
            isFinal,
            shouldBroadcast: false,
        };
    }

    // 8. Seq deduplication: only process if seq > lastSeq
    if (seq <= state.lastSeq) {
        logger.log(
            'ASR',
            `Deduplicating message (seq: ${seq}, lastSeq: ${state.lastSeq})`
        );
        return {
            success: true,
            roomId,
            speakerId,
            seq,
            text,
            isFinal,
            shouldBroadcast: false,
        };
    }

    // 9. Update last seq
    state.lastSeq = seq;

    // 10. Handle final vs partial
    if (isFinal) {
        // Final message: broadcast immediately
        state.finalReceived = true;

        // Clear any pending throttle
        if (state.throttleTimer) {
            clearTimeout(state.throttleTimer);
            state.throttleTimer = null;
        }
        state.pendingPartial = null;

        logger.log(
            'ASR',
            `Final from ${speakerId} in room ${roomId}: "${text}"`
        );

        // Accumulate final text into room's speech state
        if (text.trim()) {
            const isHost = speakerId === room.hostUserId;

            if (!room.speechState) {
                room.speechState = {
                    hostText: '',
                    guestText: '',
                    hostFinished: false,
                    guestFinished: false,
                };
            }

            if (isHost) {
                room.speechState.hostText += text.trim() + ' ';
            } else {
                room.speechState.guestText += text.trim() + ' ';
            }

            logger.log(
                'ASR',
                `Accumulated ${isHost ? 'host' : 'guest'} speech: ${isHost ? room.speechState.hostText.length : room.speechState.guestText.length} chars`
            );
        }

        // Reset session for next utterance
        // Note: We do this after a short delay to allow the final to be processed
        setTimeout(() => {
            resetSessionState(roomId, speakerId);
        }, 100);

        return {
            success: true,
            roomId,
            speakerId,
            seq,
            text,
            isFinal: true,
            shouldBroadcast: true,
        };
    } else {
        // Partial message: apply throttling
        state.pendingPartial = message;

        // If no throttle timer is active, start one
        if (!state.throttleTimer) {
            state.throttleTimer = setTimeout(() => {
                const pendingMessage = state.pendingPartial;
                state.throttleTimer = null;
                state.pendingPartial = null;

                if (pendingMessage && onThrottledBroadcast) {
                    const pendingData = pendingMessage.data;
                    logger.log(
                        'ASR',
                        `Throttled partial from ${pendingData.speakerId}: "${pendingData.text}"`
                    );
                    onThrottledBroadcast({
                        success: true,
                        roomId: pendingData.roomId,
                        speakerId: pendingData.speakerId,
                        seq: pendingData.seq,
                        text: pendingData.text,
                        isFinal: false,
                        shouldBroadcast: true,
                    });
                }
            }, PARTIAL_THROTTLE_MS);

            logger.log(
                'ASR',
                `Partial from ${speakerId} queued for throttle: "${text}"`
            );
        } else {
            logger.log(
                'ASR',
                `Partial from ${speakerId} updated pending: "${text}"`
            );
        }

        // Don't broadcast immediately for partial (throttled)
        return {
            success: true,
            roomId,
            speakerId,
            seq,
            text,
            isFinal: false,
            shouldBroadcast: false,
        };
    }
}
