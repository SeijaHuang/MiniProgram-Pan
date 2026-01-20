/**
 * Chat WebSocket Types
 * 聊天 WebSocket 消息类型定义
 * 用于 chat-room 页面的消息收发功能
 */

import type { IMessage, MessageContent } from '../models/message';
import type { IWSMessage, EWSMessageType } from './websocket-common';

// ==================== Client → Server ====================

/**
 * CHAT_SEND: Send a chat message
 * 发送聊天消息（客户端 → 服务器）
 */
export interface IChatSendMessage extends IWSMessage<IChatSendData> {
    type: EWSMessageType.ChatSend;
}

export interface IChatSendData {
    content: MessageContent;
}

// ==================== Server → Client ====================

/**
 * CHAT_RECEIVE: Broadcast chat message
 * 接收聊天消息（服务器 → 客户端）
 */
export interface IChatReceiveMessage extends IWSMessage<IChatReceiveData> {
    type: EWSMessageType.ChatReceive;
}

export interface IChatReceiveData {
    message: IMessage;
}
