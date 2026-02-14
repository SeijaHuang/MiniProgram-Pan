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
    AsrTextPush = 'ASR_TEXT_PUSH',
    EmojiSend = 'EMOJI_SEND',

    // Server → Client
    JoinAck = 'JOIN_ACK',
    ChatReceive = 'CHAT_RECEIVE',
    AsrText = 'ASR_TEXT',
    EmojiReceive = 'EMOJI_RECEIVE',
    Error = 'ERROR',

    // Speech Turn Management
    SpeechTurnEnd = 'SPEECH_TURN_END', // Client → Server
    ChatComplete = 'CHAT_COMPLETE', // Server → Client

    // Verdict Delivery
    VerdictResult = 'VERDICT_RESULT', // Server → Client
    VerdictFailed = 'VERDICT_FAILED', // Server → Client
    VerdictRetry = 'VERDICT_RETRY', // Client → Server

    // Post-Game
    PostGameAction = 'POST_GAME_ACTION',
    PostGameEffect = 'POST_GAME_EFFECT',
    LeaveTogether = 'LEAVE_TOGETHER',
    LeaveTogetherAck = 'LEAVE_TOGETHER_ACK',
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
 * Player Role in drum game
 * - Organizer: The player who created the room
 * - Joiner: The player who joined the room
 */
export enum EPlayerRole {
    Organizer = 'Organizer',
    Joiner = 'Joiner',
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
