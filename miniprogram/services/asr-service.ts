/**
 * ASR Service
 * Handles ASR text synchronization via WebSocket
 *
 * Responsibilities:
 * - Send partial ASR text (throttled)
 * - Send final ASR text (immediately)
 * - Receive and parse ASR_TEXT messages from other participants
 * - Manage sequence numbers
 *
 * NOTE: Local UI does NOT depend on broadcast - it uses local ASR callbacks
 */

import type {
    IASRTextPushMessage,
    IASRTextMessage,
} from '../types/asr-websocket';
import { EWSMessageType, type IErrorMessage } from '../types/websocket-common';

import { wsManager } from './websocket-manager';

/**
 * Throttle interval for partial messages (ms)
 */
const PARTIAL_THROTTLE_MS = 200;

/**
 * Callback types
 */
type ASRTextReceiveHandler = (
    speakerId: string,
    text: string,
    isFinal: boolean,
    seq: number
) => void;
type ASRErrorHandler = (message: string) => void;
type UnhandledMessageHandler = (data: string) => void;

interface IASRServiceState {
    /** Current room ID */
    roomId: string | null;
    /** Current speaker ID (local user) */
    speakerId: string | null;
    /** Sequence number counter */
    seq: number;
    /** Pending partial text for throttling */
    pendingPartial: string | null;
    /** Throttle timer ID */
    throttleTimer: number | null;
}

class ASRService {
    private asrTextReceiveHandler: ASRTextReceiveHandler | null = null;
    private asrErrorHandler: ASRErrorHandler | null = null;
    private unhandledMessageHandler: UnhandledMessageHandler | null = null;

    private state: IASRServiceState = {
        roomId: null,
        speakerId: null,
        seq: 0,
        pendingPartial: null,
        throttleTimer: null,
    };

    /**
     * Initialize ASR service
     * @param roomId - Current room ID
     * @param speakerId - Local user's ID
     * @param onASRTextReceive - Callback when ASR text is received from another participant
     * @param onError - Callback for errors
     */
    initialize(options: {
        roomId: string;
        speakerId: string;
        onASRTextReceive: ASRTextReceiveHandler;
        onError?: ASRErrorHandler;
        onUnhandledMessage?: UnhandledMessageHandler;
    }): void {
        this.state.roomId = options.roomId;
        this.state.speakerId = options.speakerId;
        this.state.seq = 0;
        this.asrTextReceiveHandler = options.onASRTextReceive;
        this.asrErrorHandler = options.onError ?? null;
        this.unhandledMessageHandler = options.onUnhandledMessage ?? null;

        // Register message handler
        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                this.handleMessage(data);
            },
        });

        console.log(
            `[ASRService] Initialized for room ${options.roomId}, speaker ${options.speakerId}`
        );
    }

    /**
     * Send partial ASR text (throttled)
     * Will be batched and sent at most once per PARTIAL_THROTTLE_MS
     * @param text - Partial recognition text
     */
    sendPartial(text: string): void {
        if (!this.isReady()) {
            console.warn('[ASRService] Not ready, cannot send partial');
            return;
        }

        // Store the latest partial text
        this.state.pendingPartial = text;

        // If no throttle timer is active, start one
        if (this.state.throttleTimer === null) {
            this.state.throttleTimer = setTimeout(() => {
                this.flushPendingPartial();
            }, PARTIAL_THROTTLE_MS) as unknown as number;
        }
    }

    /**
     * Send final ASR text (immediately)
     * @param text - Final recognition text
     */
    sendFinal(text: string): void {
        if (!this.isReady()) {
            console.warn('[ASRService] Not ready, cannot send final');
            return;
        }

        // Clear any pending throttle
        if (this.state.throttleTimer !== null) {
            clearTimeout(this.state.throttleTimer);
            this.state.throttleTimer = null;
        }
        this.state.pendingPartial = null;

        // Send immediately
        this.sendASRTextPush(text, true);

        console.log(`[ASRService] Sent final: "${text}"`);
    }

    /**
     * Reset sequence counter (call when starting a new utterance)
     */
    resetSequence(): void {
        this.state.seq = 0;
        this.state.pendingPartial = null;
        if (this.state.throttleTimer !== null) {
            clearTimeout(this.state.throttleTimer);
            this.state.throttleTimer = null;
        }
        console.log('[ASRService] Sequence reset');
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        if (this.state.throttleTimer !== null) {
            clearTimeout(this.state.throttleTimer);
            this.state.throttleTimer = null;
        }
        this.state.pendingPartial = null;
        this.state.roomId = null;
        this.state.speakerId = null;
        this.state.seq = 0;
        this.asrTextReceiveHandler = null;
        this.asrErrorHandler = null;
        this.unhandledMessageHandler = null;

        console.log('[ASRService] Cleaned up');
    }

    /**
     * Check if service is ready to send
     */
    private isReady(): boolean {
        return (
            this.state.roomId !== null &&
            this.state.speakerId !== null &&
            wsManager.isConnected()
        );
    }

    /**
     * Flush pending partial text
     */
    private flushPendingPartial(): void {
        this.state.throttleTimer = null;

        if (this.state.pendingPartial !== null) {
            const text = this.state.pendingPartial;
            this.state.pendingPartial = null;
            this.sendASRTextPush(text, false);
            console.log(`[ASRService] Sent throttled partial: "${text}"`);
        }
    }

    /**
     * Send ASR_TEXT_PUSH message
     */
    private sendASRTextPush(text: string, isFinal: boolean): void {
        if (!this.state.roomId || !this.state.speakerId) {
            return;
        }

        const message: IASRTextPushMessage = {
            type: EWSMessageType.AsrTextPush,
            data: {
                roomId: this.state.roomId,
                speakerId: this.state.speakerId,
                seq: this.state.seq++,
                text,
                isFinal,
            },
            timestamp: Date.now(),
        };

        wsManager.send(message);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as { type: EWSMessageType };

            if (message.type === EWSMessageType.AsrText) {
                this.handleASRText(message as unknown as IASRTextMessage);
            } else if (message.type === EWSMessageType.Error) {
                this.handleError(message as unknown as IErrorMessage);
            } else if (this.unhandledMessageHandler) {
                this.unhandledMessageHandler(data);
            }
        } catch (error) {
            console.error('[ASRService] Failed to parse message:', error);
        }
    }

    /**
     * Handle ASR_TEXT message (from another participant)
     */
    private handleASRText(message: IASRTextMessage): void {
        const { speakerId, text, isFinal, seq } = message.data;

        console.log(
            `[ASRService] Received ASR_TEXT from ${speakerId}: "${text}" (final: ${isFinal}, seq: ${seq})`
        );

        if (this.asrTextReceiveHandler) {
            this.asrTextReceiveHandler(speakerId, text, isFinal, seq);
        }
    }

    /**
     * Handle ERROR message
     */
    private handleError(message: IErrorMessage): void {
        console.error('[ASRService] Error from server:', message.data);

        if (this.asrErrorHandler) {
            this.asrErrorHandler(message.data.message);
        }
    }
}

// Export singleton instance
export const asrService = new ASRService();
