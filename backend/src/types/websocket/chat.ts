/**
 * WebSocket CHAT Types
 * Types for chat messaging flow (client send + server broadcast)
 */

import type { IWSMessage } from './base';
import { EWSMessageType } from './base';
import type { IMessage, IMessageContent } from '../../models/entities/message';

// ==================== Client → Server ====================

/**
 * CHAT_SEND: Send a chat message
 */
export interface IChatSendMessage extends IWSMessage<IChatSendData> {
    type: EWSMessageType.ChatSend;
}

export interface IChatSendData {
    content: IMessageContent;
}

// ==================== Server → Client ====================

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
