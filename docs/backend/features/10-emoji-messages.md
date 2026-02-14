# 10. 表情互动消息

## 概述

表情互动功能允许参与者在对方发言时发送表情反应，通过 WebSocket 实时转发给对方。用于 Chat Room 中监听方对发言方的互动。

---

## WebSocket 消息类型

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `EMOJI_SEND` | Client → Server | 发送表情 |
| `EMOJI_RECEIVE` | Server → Opponent Only | 接收表情（仅转发给对方） |

---

## 消息格式

### EMOJI_SEND（Client → Server）

```typescript
{
  "type": "EMOJI_SEND",
  "data": {
    "roomId": string,       // 房间ID
    "senderId": string,     // 发送者 userId
    "emoji": string         // 表情内容
  },
  "timestamp": number
}
```

### EMOJI_RECEIVE（Server → Opponent Only）

```typescript
{
  "type": "EMOJI_RECEIVE",
  "data": {
    "roomId": string,
    "senderId": string,
    "emoji": string
  },
  "timestamp": number
}
```

---

## 业务规则

- ✅ 发送者必须是房间参与者
- ✅ 仅转发给对方（使用 `broadcastToRoomExcept`，不回传给发送者）
- ✅ 无速率限制（由客户端控制发送频率）

---

## 数据流

```
发送者客户端
  ↓ EMOJI_SEND { roomId, senderId, emoji }
ws.ts (WebSocket Server)
  ↓
controllers/ws-controller.ts
  ↓ handleEmojiSendMessage()
services/handlers/emoji-text-handler.ts
  ↓ handleEmojiText() — 验证消息格式
  ↓ 返回结果
controllers/ws-controller.ts
  ↓ connectionManager.broadcastToRoomExcept(roomId, message, senderId)
对方客户端收到 EMOJI_RECEIVE
```

---

## 涉及文件

| 文件 | 职责 |
|------|------|
| `controllers/ws-controller.ts` | 消息路由 (`handleEmojiSendMessage`) |
| `services/handlers/emoji-text-handler.ts` | 业务逻辑验证 |
| `models/schemas/emoji-message.schema.ts` | Zod 验证 Schema |
| `types/websocket/emoji.ts` | TypeScript 类型定义 |

---

## 错误处理

| 场景 | 错误码 |
|------|--------|
| 消息格式错误 | `INVALID_PAYLOAD` |
| 用户不是房间参与者 | `NOT_PARTICIPANT` |
| 房间不存在 | `ROOM_NOT_FOUND` |

---

## 示例

### 发送表情

```json
{
  "type": "EMOJI_SEND",
  "data": {
    "roomId": "room_123456",
    "senderId": "user_bob",
    "emoji": "😂"
  },
  "timestamp": 1737878410000
}
```

### 对方收到

```json
{
  "type": "EMOJI_RECEIVE",
  "data": {
    "roomId": "room_123456",
    "senderId": "user_bob",
    "emoji": "😂"
  },
  "timestamp": 1737878410100
}
```

---

## 使用场景

在 Chat Room 中，当一方正在发言时，另一方（监听方）可以通过表情互动系统发送表情反应：
- 表情以弹幕/飞行物形式在对方屏幕上展示
- 增加互动趣味性

---

## 相关文档

- [API 规格说明](../api-specification.md)
- [聊天消息](03-chat-messaging.md)
- [数据模型](../data-models.md)
