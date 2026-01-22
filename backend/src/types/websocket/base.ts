/**
 * WebSocket Base Types
 * Core WebSocket message structure and enums
 */

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
 * Base WebSocket Message
 * Generic container for all WebSocket messages
 */
export interface IWSMessage<T = unknown> {
    type: EWSMessageType;
    data: T;
    timestamp: number;
}
