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
import { roomManager } from '../websocket/room-manager';
import { ERoomStatus } from '../../models/entities/room';
import type { ConnectionManager } from '../websocket/connection-manager';
import { ASRTextPushDataSchema } from '../../models/schemas/ws-asr-text-push.schema';

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
 * Clean up session state when room/user disconnects
 */
export function cleanupASRSession(roomId: string, speakerId?: string): void {
    if (speakerId) {
        const key = getSessionKey(roomId, speakerId);
        const state = sessionStates.get(key);
        if (state?.throttleTimer) {
            clearTimeout(state.throttleTimer);
        }
        sessionStates.delete(key);
    } else {
        // Clean up all sessions for this room
        for (const [key, state] of sessionStates.entries()) {
            if (key.startsWith(`${roomId}:`)) {
                if (state.throttleTimer) {
                    clearTimeout(state.throttleTimer);
                }
                sessionStates.delete(key);
            }
        }
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
    const validation = ASRTextPushDataSchema.safeParse(message.data);
    if (!validation.success) {
        const firstError = validation.error.issues[0];
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: firstError?.message ?? 'Invalid payload',
        };
    }

    const { roomId, speakerId, seq, text, isFinal } = validation.data;

    // 2. Get connection metadata
    const connectionData = connectionManager.getConnection(connectionId);
    if (!connectionData || !connectionData.userId || !connectionData.roomId) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You must join a room first',
        };
    }

    // 3. Verify speakerId matches connection's userId
    if (connectionData.userId !== speakerId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'speakerId must match your userId',
        };
    }

    // 4. Verify roomId matches connection's roomId
    if (connectionData.roomId !== roomId) {
        return {
            success: false,
            code: EWSErrorCode.InvalidPayload,
            message: 'roomId must match your current room',
        };
    }

    // 5. Validate room exists and is ready
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
            message: 'Room is not ready (need 2 participants)',
        };
    }

    // 6. Verify sender is a participant
    const sender = room.participants.find(p => p.user.userId === speakerId);
    if (!sender) {
        return {
            success: false,
            code: EWSErrorCode.NotParticipant,
            message: 'You are not a participant of this room',
        };
    }

    // 7. Get or create session state
    const state = getOrCreateSessionState(roomId, speakerId);

    // 8. Check if final was already received (ignore subsequent messages)
    if (state.finalReceived && seq <= state.lastSeq) {
        console.log(
            `[ASR_TEXT_PUSH] Ignoring message after final (seq: ${seq}, lastSeq: ${state.lastSeq})`
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

    // 9. Seq deduplication: only process if seq > lastSeq
    if (seq <= state.lastSeq) {
        console.log(
            `[ASR_TEXT_PUSH] Deduplicating message (seq: ${seq}, lastSeq: ${state.lastSeq})`
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

    // 10. Update last seq
    state.lastSeq = seq;

    // 11. Handle final vs partial
    if (isFinal) {
        // Final message: broadcast immediately
        state.finalReceived = true;

        // Clear any pending throttle
        if (state.throttleTimer) {
            clearTimeout(state.throttleTimer);
            state.throttleTimer = null;
        }
        state.pendingPartial = null;

        console.log(
            `[ASR_TEXT_PUSH] Final from ${speakerId} in room ${roomId}: "${text}"`
        );

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
                    console.log(
                        `[ASR_TEXT_PUSH] Throttled partial from ${pendingData.speakerId}: "${pendingData.text}"`
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

            console.log(
                `[ASR_TEXT_PUSH] Partial from ${speakerId} queued for throttle: "${text}"`
            );
        } else {
            console.log(
                `[ASR_TEXT_PUSH] Partial from ${speakerId} updated pending: "${text}"`
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
