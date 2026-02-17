/**
 * Emoji WebSocket Types
 * 表情反应 WebSocket 消息类型定义
 * 用于 chat-room 页面的表情接收功能
 */

// ==================== Server → Client ====================

export interface IEmojiReceiveData {
    roomId: string;
    emoji: string;
}
