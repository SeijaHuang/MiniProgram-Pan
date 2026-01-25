/**
 * WebSocket DRUM Types
 * Types for drum game real-time communication
 *
 * Message Flow:
 * - DRUM_READY: Server → Client (Room ready, sync time)
 * - DRUM_START: Server → Client (Game start signal with timing)
 * - DRUM_TAP: Bidirectional (Tap events)
 * - DRUM_FINISH: Server → Client (Game finish signal)
 * - DRUM_RESULT: Server → Client (Final result)
 */

import type { IWSMessage } from './base';
import { EWSMessageType, EPlayerRole } from './base';

// Re-export EPlayerRole for convenience
export { EPlayerRole } from './base';

// ==================== Game Phase ====================

/**
 * Drum Game Phase
 */
export enum EGamePhase {
    Waiting = 'WAITING',
    Countdown = 'COUNTDOWN',
    Running = 'RUNNING',
    Finished = 'FINISHED',
}

// ==================== Server → Client ====================

/**
 * DRUM_READY: Room is ready, sync server time
 */
export interface IDrumReadyMessage extends IWSMessage<IDrumReadyData> {
    type: EWSMessageType.DrumReady;
}

export interface IDrumReadyData {
    roomId: string;
    serverTimeMs: number;
    hostRole: EPlayerRole;
    playerAName: string;
    playerBName: string;
}

/**
 * DRUM_START: Game start signal
 */
export interface IDrumStartMessage extends IWSMessage<IDrumStartData> {
    type: EWSMessageType.DrumStart;
}

export interface IDrumStartData {
    roomId: string;
    startAtMs: number; // Absolute timestamp when game starts (after countdown)
}

/**
 * DRUM_FINISH: Game finish signal
 */
export interface IDrumFinishMessage extends IWSMessage<IDrumFinishData> {
    type: EWSMessageType.DrumFinish;
}

export interface IDrumFinishData {
    roomId: string;
    endAtMs: number;
}

/**
 * DRUM_RESULT: Final game result
 */
export interface IDrumResultMessage extends IWSMessage<IDrumResultData> {
    type: EWSMessageType.DrumResult;
}

export interface IDrumResultData {
    roomId: string;
    scoreA: number;
    scoreB: number;
    winnerRole: EPlayerRole;
}

// ==================== Bidirectional ====================

/**
 * DRUM_TAP: Player tap event
 * Client → Server: Player sends their taps
 * Server → Client: Broadcast opponent's taps
 */
export interface IDrumTapMessage extends IWSMessage<IDrumTapData> {
    type: EWSMessageType.DrumTap;
}

export interface IDrumTapData {
    roomId: string;
    role: EPlayerRole;
    delta: number; // Number of taps in this batch
    clientTimeMs: number;
}

// ==================== Union Type ====================

/**
 * Union type for all drum messages
 */
export type TDrumMessage =
    | IDrumReadyMessage
    | IDrumStartMessage
    | IDrumTapMessage
    | IDrumFinishMessage
    | IDrumResultMessage;
