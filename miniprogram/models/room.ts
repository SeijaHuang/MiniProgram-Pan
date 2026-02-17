/**
 * Room Model
 * Represents a chat room
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
