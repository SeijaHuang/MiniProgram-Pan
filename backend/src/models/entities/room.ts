/**
 * Room Domain Model
 * Represents a two-user chat room
 *
 * CRITICAL: Room does NOT store WebSocket or connection info
 * CRITICAL: participants.length must NEVER exceed 2
 * CRITICAL: Room state controls allowed operations
 */

import type { IUser } from './user';
import type { IVerdictResult } from '../../types/websocket/verdict';

export enum ERoomStatus {
    Waiting = 'WAITING',
    Ready = 'READY',
    Closed = 'CLOSED',
}

export interface IParticipant {
    user: IUser;
    joinedAt: number;
    leftAt?: number;
}

/**
 * Speech State
 * Tracks accumulated ASR text and turn completion for both players
 */
export interface ISpeechState {
    /** Accumulated final ASR text for host */
    hostText: string;
    /** Accumulated final ASR text for guest */
    guestText: string;
    /** Whether host finished their turn */
    hostFinished: boolean;
    /** Whether guest finished their turn */
    guestFinished: boolean;
}

/**
 * Verdict Status
 * Tracks the state of verdict generation
 */
export type TVerdictStatus =
    | 'pending' // Initial state or ready for retry
    | 'processing' // LLM call in progress
    | 'completed' // Verdict ready
    | 'failed'; // LLM call failed

export interface IRoom {
    roomId: string;
    roomCode: string;
    hostUserId: string;
    participants: IParticipant[];
    status: ERoomStatus;
    createdAt: number;

    // Speech and verdict fields
    speechState?: ISpeechState;
    verdictStatus?: TVerdictStatus;
    verdictResult?: IVerdictResult;
    verdictRetryCount?: number;
}
