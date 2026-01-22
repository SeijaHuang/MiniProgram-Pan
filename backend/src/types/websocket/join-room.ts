/**
 * WebSocket JOIN_ROOM Types
 * Types for room join flow (client request + server acknowledgment)
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';
import type { IUser } from '../../models/entities/user';
import type { IRoom } from '../../models/entities/room';

// ==================== Client → Server ====================

/**
 * JOIN_ROOM: Request to join a room using a roomCode
 */
export interface IJoinRoomMessage extends IWSMessage<IJoinRoomData> {
    type: EWSMessageType.JoinRoom;
}

export interface IJoinRoomData {
    roomCode: string;
    user: IUser;
}

// ==================== Server → Client ====================

/**
 * JOIN_ACK: Authoritative confirmation of room join
 * CRITICAL: Must include full room state
 * CRITICAL: Sent to ALL participants
 */
export interface IJoinAckMessage extends IWSMessage<IJoinAckData> {
    type: EWSMessageType.JoinAck;
}

export interface IJoinAckData {
    room: IRoom;
}
