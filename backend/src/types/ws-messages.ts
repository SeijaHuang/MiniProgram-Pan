/**
 * WebSocket Transport Layer Types
 * Defines the protocol for client-server real-time communication
 *
 * CRITICAL: WebSocket is used ONLY for:
 * - Joining rooms
 * - Broadcasting messages
 * - Handling disconnects
 * - Sending protocol-level errors
 *
 * CRITICAL: Room creation is handled via HTTP
 */

import type { IUser } from '../models/user';
import type { IRoom } from '../models/room';
import type { IMessage, MessageContent } from '../models/message';

/**
 * WebSocket Message Types
 */
export enum EWSMessageType {
    // Client → Server
    JoinRoom = 'JOIN_ROOM',
    ChatSend = 'CHAT_SEND',

    // Server → Client
    JoinAck = 'JOIN_ACK',
    ChatReceive = 'CHAT_RECEIVE',
    Error = 'ERROR',
}

/**
 * WebSocket Error Codes
 */
export enum EWSErrorCode {
    InvalidPayload = 'INVALID_PAYLOAD',
    RoomNotFound = 'ROOM_NOT_FOUND',
    RoomFull = 'ROOM_FULL',
    RoomClosed = 'ROOM_CLOSED',
    NotParticipant = 'NOT_PARTICIPANT',
    RoomNotReady = 'ROOM_NOT_READY',
    AlreadyJoined = 'ALREADY_JOINED',
    InternalError = 'INTERNAL_ERROR',
}

/**
 * Base WebSocket Message
 */
export interface IWSMessage<T = unknown> {
    type: EWSMessageType;
    data: T;
    timestamp: number;
}

// ==================== Client → Server Messages ====================

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

/**
 * CHAT_SEND: Send a chat message
 */
export interface IChatSendMessage extends IWSMessage<IChatSendData> {
    type: EWSMessageType.ChatSend;
}

export interface IChatSendData {
    content: MessageContent;
}

// ==================== Server → Client Messages ====================

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

/**
 * CHAT_RECEIVE: Broadcast chat message
 * CRITICAL: Only sent after server validation
 * CRITICAL: Sent to all participants in the room
 */
export interface IChatReceiveMessage extends IWSMessage<IChatReceiveData> {
    type: EWSMessageType.ChatReceive;
}

export interface IChatReceiveData {
    message: IMessage;
}

/**
 * ERROR: Protocol or domain failure
 * CRITICAL: Must not change room state
 * CRITICAL: Client must treat error as authoritative
 */
export interface IWSErrorMessage extends IWSMessage<IWSErrorData> {
    type: EWSMessageType.Error;
}

export interface IWSErrorData {
    code: EWSErrorCode;
    message?: string;
}

/**
 * Union type of all WebSocket messages
 */
export type WSMessage =
    | IJoinRoomMessage
    | IChatSendMessage
    | IJoinAckMessage
    | IChatReceiveMessage
    | IWSErrorMessage;
