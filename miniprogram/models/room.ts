/**
 * Room Model
 * Represents a chat room
 */

import type { IUser } from '@/models/user';

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

/**
 * 判断用户是否为房主
 * 使用后端返回的 hostUserId 字段进行判断
 */
export function isRoomHost(room: IRoom, userId: string): boolean {
    return room.hostUserId === userId;
}
