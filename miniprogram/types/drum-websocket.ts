/**
 * Drum Room WebSocket Types
 * Message protocols for drum room real-time communication
 */

import { EPlayerRole } from '@/types/websocket-common';

// Re-export EPlayerRole for convenience
export { EPlayerRole } from '@/types/websocket-common';

/**
 * Drum Room Message Types
 */
export enum EDrumMessageType {
    // Server -> Client: Room ready, sync time
    DrumReady = 'DRUM_READY',

    // Server -> Client: Game start signal with timing
    DrumStart = 'DRUM_START',

    // Bidirectional: Tap events
    DrumTap = 'DRUM_TAP',

    // Server -> Client: Game finish signal
    DrumFinish = 'DRUM_FINISH',

    // Server -> Client: Final result
    DrumResult = 'DRUM_RESULT',
}

/**
 * Drum Game Phase
 */
export enum EGamePhase {
    Waiting = 'WAITING',
    Countdown = 'COUNTDOWN',
    Running = 'RUNNING',
    Finished = 'FINISHED',
}

/**
 * Base Drum Message
 */
export interface IDrumMessage<T = object> {
    type: EDrumMessageType;
    data: T;
    timestamp: number;
}

/**
 * DRUM_READY: Room is ready, sync server time
 * Server -> Client
 */
export interface IDrumReadyData {
    roomId: string;
    serverTimeMs: number;
    hostRole: EPlayerRole;
    organizerName: string;
    joinerName: string;
}

export interface IDrumReadyMessage extends IDrumMessage<IDrumReadyData> {
    type: EDrumMessageType.DrumReady;
}

/**
 * DRUM_START: Game start signal
 * Server -> Client
 */
export interface IDrumStartData {
    roomId: string;
    startAtMs: number; // Absolute timestamp when game starts (after 3s countdown)
}

export interface IDrumStartMessage extends IDrumMessage<IDrumStartData> {
    type: EDrumMessageType.DrumStart;
}

/**
 * DRUM_TAP: Player tap event
 * Client -> Server & Server -> Client
 */
export interface IDrumTapData {
    roomId: string;
    role: EPlayerRole;
    delta: number; // Number of taps in this batch
    clientTimeMs: number;
}

export interface IDrumTapMessage extends IDrumMessage<IDrumTapData> {
    type: EDrumMessageType.DrumTap;
}

/**
 * DRUM_FINISH: Game finish signal
 * Server -> Client (or Client request)
 */
export interface IDrumFinishData {
    roomId: string;
    endAtMs: number;
}

export interface IDrumFinishMessage extends IDrumMessage<IDrumFinishData> {
    type: EDrumMessageType.DrumFinish;
}

/**
 * DRUM_RESULT: Final game result
 * Server -> Client
 */
export interface IDrumResultData {
    roomId: string;
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;
}

export interface IDrumResultMessage extends IDrumMessage<IDrumResultData> {
    type: EDrumMessageType.DrumResult;
}

/**
 * Union type for all drum messages
 */
export type TDrumMessage =
    | IDrumReadyMessage
    | IDrumStartMessage
    | IDrumTapMessage
    | IDrumFinishMessage
    | IDrumResultMessage;

/**
 * Parse incoming WebSocket message as drum message
 * @param rawData - Raw WebSocket message string
 * @returns Parsed drum message or null if invalid
 */
export function parseDrumMessage(rawData: string): TDrumMessage | null {
    try {
        const message: unknown = JSON.parse(rawData);
        if (
            typeof message === 'object' &&
            message !== null &&
            'type' in message &&
            'data' in message
        ) {
            return message as TDrumMessage;
        }
        return null;
    } catch (e) {
        console.error('[DrumWS] Failed to parse message:', e);
        return null;
    }
}

/**
 * Create drum tap message payload
 * @param roomId - Room ID
 * @param role - Player role
 * @param delta - Tap count
 * @returns Message object ready to send
 */
export function createTapMessage(
    roomId: string,
    role: EPlayerRole,
    delta: number
): IDrumTapMessage {
    return {
        type: EDrumMessageType.DrumTap,
        data: {
            roomId,
            role,
            delta,
            clientTimeMs: Date.now(),
        },
        timestamp: Date.now(),
    };
}
