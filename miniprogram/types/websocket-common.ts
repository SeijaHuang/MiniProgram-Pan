/**
 * WebSocket Common Types
 * 通用 WebSocket 类型定义
 * 用于所有 WebSocket 通信的基础类型
 */

/**
 * WebSocket Message Types
 * WebSocket 消息类型枚举
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
 * WebSocket 错误码
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
 * WebSocket 消息基础结构
 */
export interface IWSMessage<T = unknown> {
    type: EWSMessageType;
    data: T;
    timestamp: number;
}

/**
 * ERROR: Error message
 * 错误消息（服务器 → 客户端）
 */
export interface IErrorMessage extends IWSMessage<IErrorData> {
    type: EWSMessageType.Error;
}

export interface IErrorData {
    code: EWSErrorCode;
    message: string;
}
