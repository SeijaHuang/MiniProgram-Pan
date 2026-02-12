/**
 * Emoji WebSocket Types
 * 表情反应 WebSocket 消息类型定义
 * 用于 chat-room 页面的表情发送/接收功能
 */

import type { EWSMessageType, IWSMessage } from './websocket-common';

// ==================== Client → Server ====================

/**
 * EMOJI_SEND: Send an emoji reaction
 * 发送表情反应（客户端 → 服务器）
 */
export interface IEmojiSendMessage extends IWSMessage<IEmojiSendData> {
    type: EWSMessageType.EmojiSend;
}

export interface IEmojiSendData {
    roomId: string;
    senderId: string;
    emoji: string;
}

// ==================== Server → Client ====================

/**
 * EMOJI_RECEIVE: Receive emoji reaction from opponent
 * 接收对方的表情反应（服务器 → 客户端）
 */
export interface IEmojiReceiveMessage extends IWSMessage<IEmojiReceiveData> {
    type: EWSMessageType.EmojiReceive;
}

export interface IEmojiReceiveData {
    roomId: string;
    emoji: string;
}
