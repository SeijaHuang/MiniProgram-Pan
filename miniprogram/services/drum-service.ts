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
    EPlayerRole,
    parseDrumMessage,
    createTapMessage,
    type TDrumMessage,
} from '../types/drum-websocket';

/** Handler for opponent tap events */
type DrumTapHandler = (role: EPlayerRole, delta: number) => void;

/** Handler for game result events */
type DrumResultHandler = (winnerRole: EPlayerRole) => void;

/** Handler for errors */
type DrumErrorHandler = (message: string) => void;

/** Handler for DRUM_READY events */
type DrumReadyHandler = (
    serverTimeMs: number,
    hostRole: EPlayerRole,
    organizerName: string,
    joinerName: string
) => void;

/** Handler for DRUM_START events */
type DrumStartHandler = (startAtMs: number) => void;

/** Handler for DRUM_FINISH events */
type DrumFinishHandler = () => void;

/** Tap batching configuration */
const TAP_THROTTLE_MS: number = 150;

class DrumService {
    private tapHandler: DrumTapHandler | null = null;
    private resultHandler: DrumResultHandler | null = null;
    private errorHandler: DrumErrorHandler | null = null;
    private readyHandler: DrumReadyHandler | null = null;
    private startHandler: DrumStartHandler | null = null;
    private finishHandler: DrumFinishHandler | null = null;

    /** Batched tap state */
    private pendingDelta: number = 0;
    private tapFlushTimer: ReturnType<typeof setTimeout> | null = null;
    private currentRoomId: string = '';
    private currentRole: EPlayerRole = EPlayerRole.Organizer;

    /**
     * Initialize drum service with handlers
     */
    initialize(
        roomId: string,
        selfRole: EPlayerRole,
        onReady: DrumReadyHandler,
        onStart: DrumStartHandler,
        onTap: DrumTapHandler,
        onFinish: DrumFinishHandler,
        onResult: DrumResultHandler,
        onError: DrumErrorHandler
    ): void {
        this.currentRoomId = roomId;
        this.currentRole = selfRole;
        this.readyHandler = onReady;
        this.startHandler = onStart;
        this.tapHandler = onTap;
        this.finishHandler = onFinish;
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
        this.readyHandler = null;
        this.startHandler = null;
        this.finishHandler = null;

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
            case EDrumMessageType.DrumReady:
                this.handleReady(
                    message.data.serverTimeMs,
                    message.data.hostRole,
                    message.data.organizerName,
                    message.data.joinerName
                );
                break;

            case EDrumMessageType.DrumStart:
                this.handleStart(message.data.startAtMs);
                break;

            case EDrumMessageType.DrumTap:
                this.handleTap(message.data.role, message.data.delta);
                break;

            case EDrumMessageType.DrumFinish:
                this.handleFinish();
                break;

            case EDrumMessageType.DrumResult:
                this.handleResult(message.data.winnerRole);
                break;

            default:
                break;
        }
    }

    /**
     * Handle DRUM_READY event
     */
    private handleReady(
        serverTimeMs: number,
        hostRole: EPlayerRole,
        organizerName: string,
        joinerName: string
    ): void {
        if (this.readyHandler) {
            this.readyHandler(
                serverTimeMs,
                hostRole,
                organizerName,
                joinerName
            );
        }
    }

    /**
     * Handle DRUM_START event
     */
    private handleStart(startAtMs: number): void {
        if (this.startHandler) {
            this.startHandler(startAtMs);
        }
    }

    /**
     * Handle opponent tap event
     */
    private handleTap(role: EPlayerRole, delta: number): void {
        if (this.tapHandler) {
            this.tapHandler(role, delta);
        }
    }

    /**
     * Handle DRUM_FINISH event
     */
    private handleFinish(): void {
        if (this.finishHandler) {
            this.finishHandler();
        }
    }

    /**
     * Handle game result
     */
    private handleResult(winnerRole: EPlayerRole): void {
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
