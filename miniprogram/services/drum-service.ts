/**
 * Drum Service
 * Handles drum room WebSocket message sending and receiving
 *
 * Responsibilities:
 * - Send tap messages (batched)
 * - Receive and parse drum messages (DRUM_TAP, DRUM_RESULT)
 * - Handle drum-related errors
 * - Queue early messages before drum-room is ready
 */

import { wsManager } from '@/services/websocket-manager';
import {
    EDrumMessageType,
    EPlayerRole,
    parseDrumMessage,
    createTapMessage,
    type TDrumMessage,
} from '@/types/drum-websocket';

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
    joinerName: string,
    receivedAtMs: number
) => void;

/** Handler for DRUM_START events */
type DrumStartHandler = (startAtMs: number) => void;

/** Handler for DRUM_FINISH events */
type DrumFinishHandler = () => void;

/** Options for initializing drum service */
interface IDrumServiceOptions {
    roomId: string;
    selfRole: EPlayerRole;
    onReady: DrumReadyHandler;
    onStart: DrumStartHandler;
    onTap: DrumTapHandler;
    onFinish: DrumFinishHandler;
    onResult: DrumResultHandler;
    onError: DrumErrorHandler;
}

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

    /** Queued message with receive timestamp */
    private messageQueue: Array<{
        message: TDrumMessage;
        receivedAtMs: number;
    }> = [];
    private isListening: boolean = false;

    /**
     * Start listening for drum messages early
     * Call this from waiting-room when room becomes ready
     * Messages will be queued until initialize() is called
     */
    startListening(): void {
        if (this.isListening) {
            return;
        }

        this.isListening = true;
        this.messageQueue = [];

        wsManager.updateCallbacks({
            onMessage: (data: string) => {
                this.handleMessage(data);
            },
        });

        console.log('[DrumService] Started listening for drum messages');
    }

    /**
     * Initialize drum service with handlers
     * Processes any queued messages from early listening
     */
    initialize(options: IDrumServiceOptions): void {
        this.currentRoomId = options.roomId;
        this.currentRole = options.selfRole;
        this.readyHandler = options.onReady;
        this.startHandler = options.onStart;
        this.tapHandler = options.onTap;
        this.finishHandler = options.onFinish;
        this.resultHandler = options.onResult;
        this.errorHandler = options.onError;

        // If not already listening, start now
        if (!this.isListening) {
            wsManager.updateCallbacks({
                onMessage: (data: string) => {
                    this.handleMessage(data);
                },
            });
        }

        console.log('[DrumService] Initialized for room:', options.roomId);

        // Process any queued messages
        this.processQueuedMessages();
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

        this.messageQueue = [];
        this.isListening = false;

        wsManager.updateCallbacks({
            onMessage: undefined,
        });

        console.log('[DrumService] Cleaned up');
    }

    /**
     * Process queued messages
     * Called after handlers are set up in initialize()
     * Uses original receive time for accurate time sync
     */
    private processQueuedMessages(): void {
        if (this.messageQueue.length === 0) {
            return;
        }

        console.log(
            '[DrumService] Processing queued messages:',
            this.messageQueue.length
        );

        const queuedItems = [...this.messageQueue];
        this.messageQueue = [];

        for (const item of queuedItems) {
            this.dispatchMessageWithReceiveTime(
                item.message,
                item.receivedAtMs
            );
        }
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
     * Queues messages if handlers aren't ready yet
     */
    private handleMessage(data: string): void {
        const message: TDrumMessage | null = parseDrumMessage(data);
        if (!message) {
            return;
        }

        console.log('[DrumService] Message received:', message.type);

        // If handlers aren't ready, queue DRUM_READY and DRUM_START messages
        // Record receive time for accurate time sync
        if (!this.readyHandler || !this.startHandler) {
            if (
                message.type === EDrumMessageType.DrumReady ||
                message.type === EDrumMessageType.DrumStart
            ) {
                console.log(
                    '[DrumService] Queuing message:',
                    message.type,
                    'receivedAtMs:',
                    Date.now()
                );
                this.messageQueue.push({
                    message,
                    receivedAtMs: Date.now(),
                });
                return;
            }
        }

        this.dispatchMessage(message);
    }

    /**
     * Dispatch message to appropriate handler
     * Uses current time for immediate messages
     */
    private dispatchMessage(message: TDrumMessage): void {
        this.dispatchMessageWithReceiveTime(message, Date.now());
    }

    /**
     * Dispatch message with specific receive time
     * Used for queued messages to maintain accurate timing
     */
    private dispatchMessageWithReceiveTime(
        message: TDrumMessage,
        receivedAtMs: number
    ): void {
        switch (message.type) {
            case EDrumMessageType.DrumReady:
                this.handleReady(
                    message.data.serverTimeMs,
                    message.data.hostRole,
                    message.data.organizerName,
                    message.data.joinerName,
                    receivedAtMs
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
        joinerName: string,
        receivedAtMs: number
    ): void {
        if (this.readyHandler) {
            this.readyHandler(
                serverTimeMs,
                hostRole,
                organizerName,
                joinerName,
                receivedAtMs
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
