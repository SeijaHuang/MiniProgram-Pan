/**
 * Room Domain Model
 * Represents a two-user chat room
 *
 * CRITICAL: Room does NOT store WebSocket or connection info
 * CRITICAL: participants.length must NEVER exceed 2
 * CRITICAL: Room state controls allowed operations
 */

import type { IUser } from './user';

export enum ERoomStatus {
    Waiting = 'WAITING',
    Ready = 'READY',
    Closed = 'CLOSED',
}

export interface IParticipant {
    user: IUser;
    joinedAt: number;
}

export interface IRoom {
    roomId: string;
    roomCode: string;
    hostUserId: string;
    participants: IParticipant[];
    status: ERoomStatus;
    createdAt: number;
}
