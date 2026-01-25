/**
 * Drum Service
 * Handles drum room WebSocket message sending and receiving
 *
 * Responsibilities:
 * - Send tap messages (batched)
 * - Receive and parse drum messages (DRUM_TAP, DRUM_RESULT)
 * - Handle drum-related errors
 */

import { wsManager } from './websocket-manager';
import {
    EDrumMessageType,
    parseDrumMessage,
    createTapMessage,
    type TPlayerRole,
    type TDrumMessage,
} from '../types/drum-websocket';

/** Handler for opponent tap events */
type DrumTapHandler = (role: TPlayerRole, delta: number) => void;

/** Handler for game result events */
type DrumResultHandler = (winnerRole: TPlayerRole) => void;

/** Handler for errors */
type DrumErrorHandler = (message: string) => void;

/** Tap batching configuration */
const TAP_THROTTLE_MS: number = 150;

class DrumService {
    private tapHandler: DrumTapHandler | null = null;
    private resultHandler: DrumResultHandler | null = null;
    private errorHandler: DrumErrorHandler | null = null;

    /** Batched tap state */
    private pendingDelta: number = 0;
    private tapFlushTimer: ReturnType<typeof setTimeout> | null = null;
    private currentRoomId: string = '';
    private currentRole: TPlayerRole = 'Organizer';

    /**
     * Initialize drum service with handlers
     */
    initialize(
        roomId: string,
        selfRole: TPlayerRole,
        onTap: DrumTapHandler,
        onResult: DrumResultHandler,
        onError: DrumErrorHandler
    ): void {
        this.currentRoomId = roomId;
        this.currentRole = selfRole;
        this.tapHandler = onTap;
        this.resultHandler = onResult;
        this.errorHandler = onError;

        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                this.handleMessage(data);
            },
        });

        console.log('[DrumService] Initialized for room:', roomId);
    }

    /**
     * Cleanup service
     * Call this in page onUnload
     */
    cleanup(): void {
        this.flushPendingTaps();
        this.clearTapTimer();

        this.tapHandler = null;
        this.resultHandler = null;
        this.errorHandler = null;

        wsManager.updateCallbacks({
            onMessage: undefined,
        });

        console.log('[DrumService] Cleaned up');
    }

    /**
     * Queue a tap for batched sending
     */
    queueTap(): void {
        this.pendingDelta++;

        if (this.tapFlushTimer === null) {
            this.tapFlushTimer = setTimeout(() => {
                this.flushPendingTaps();
            }, TAP_THROTTLE_MS);
        }
    }

    /**
     * Flush pending taps to server
     */
    flushPendingTaps(): void {
        if (this.pendingDelta === 0) {
            return;
        }

        const delta: number = this.pendingDelta;
        this.pendingDelta = 0;
        this.clearTapTimer();

        if (!wsManager.isConnected()) {
            console.error('[DrumService] Not connected, cannot send taps');
            return;
        }

        const tapMessage = createTapMessage(
            this.currentRoomId,
            this.currentRole,
            delta
        );
        wsManager.send(tapMessage);

        console.log('[DrumService] Sent taps:', delta);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        const message: TDrumMessage | null = parseDrumMessage(data);
        if (!message) {
            return;
        }

        console.log('[DrumService] Message received:', message.type);

        switch (message.type) {
            case EDrumMessageType.DrumTap:
                this.handleTap(message.data.role, message.data.delta);
                break;

            case EDrumMessageType.DrumResult:
                this.handleResult(message.data.winnerRole);
                break;

            default:
                break;
        }
    }

    /**
     * Handle opponent tap event
     */
    private handleTap(role: TPlayerRole, delta: number): void {
        if (this.tapHandler) {
            this.tapHandler(role, delta);
        }
    }

    /**
     * Handle game result
     */
    private handleResult(winnerRole: TPlayerRole): void {
        if (this.resultHandler) {
            this.resultHandler(winnerRole);
        }
    }

    /**
     * Clear tap flush timer
     */
    private clearTapTimer(): void {
        if (this.tapFlushTimer !== null) {
            clearTimeout(this.tapFlushTimer);
            this.tapFlushTimer = null;
        }
    }
}

// Export singleton instance
export const drumService = new DrumService();
