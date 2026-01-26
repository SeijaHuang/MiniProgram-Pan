# 功能文档：聊天消息

## 概述

双人聊天室的核心功能，参与者通过 WebSocket 发送和接收实时文本消息。

**协议**: WebSocket  
**消息类型**: `CHAT_SEND` (Client → Server), `CHAT_RECEIVE` (Server → Client)

---

## 业务流程

### 流程图

```
发送者                    服务器                    接收者
  |                        |                          |
  |-- CHAT_SEND ---------->|                          |
  |   (仅包含内容)         |-- 验证用户身份           |
  |                        |-- 验证房间状态           |
  |                        |-- 生成消息ID             |
  |                        |-- 添加时间戳             |
  |                        |-- 记录发送者信息         |
  |                        |                          |
  |<--- CHAT_RECEIVE ------|---- CHAT_RECEIVE ------->|
  |   (完整消息对象)       |   (广播给所有人)        |
```

### 详细步骤

1. **客户端发送消息**
   - 仅发送消息内容（文本）
   - 通过已建立的 WebSocket 连接

2. **服务器验证**
   - ✅ 用户是否是房间参与者
   - ✅ 房间状态是否为 `READY`（双方就位）
   - ✅ 消息内容是否有效（非空）

3. **服务器增强消息**
   - 生成唯一 `messageId`（UUID）
   - 添加服务器时间戳（权威时间）
   - 附加发送者完整信息
   - 附加房间 ID

4. **广播消息**
   - 发送 `CHAT_RECEIVE` 给所有参与者
   - 包括发送者本人（确保状态同步）

---

## 消息协议

### CHAT_SEND (Client → Server)

**方向**: 客户端 → 服务器  
**用途**: 发送聊天消息

```typescript
{
  type: "CHAT_SEND";
  data: {
    content: {
      type: "TEXT";      // 当前仅支持文本
      text: string;      // 消息文本内容
    }
  };
  timestamp: number;     // 客户端时间戳（仅参考）
}
```

**示例**:
```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hello, how are you?"
    }
  },
  "timestamp": 1737849800000
}
```

**字段说明**:
- `content.type`: 消息类型，当前仅支持 `"TEXT"`
- `content.text`: 文本内容，不能为空
- `timestamp`: 客户端发送时间（服务器会替换为服务器时间）

---

### CHAT_RECEIVE (Server → Client)

**方向**: 服务器 → 所有参与者（广播）  
**用途**: 接收聊天消息

```typescript
{
  type: "CHAT_RECEIVE";
  data: {
    message: {
      messageId: string;    // 服务器生成的唯一ID
      roomId: string;       // 房间ID
      sender: {             // 发送者信息
        userId: string;
        nickname: string;
      };
      type: "TEXT";         // 消息类型
      content: {
        type: "TEXT";
        text: string;
      };
      createdAt: number;    // 服务器时间戳（权威）
    }
  };
  timestamp: number;        // 服务器时间戳
}
```

**示例**:
```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": "msg-f47ac10b-58cc",
      "roomId": "room-12345",
      "sender": {
        "userId": "user-001",
        "nickname": "Alice"
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": "Hello, how are you?"
      },
      "createdAt": 1737849800050
    }
  },
  "timestamp": 1737849800050
}
```

**字段说明**:
- `messageId`: UUID 格式，用于消息去重和引用
- `roomId`: 所属房间ID
- `sender`: 完整的发送者信息（服务器权威）
- `createdAt`: 服务器生成的时间戳（避免客户端时间不一致）
- `timestamp`: 外层时间戳（与 createdAt 相同）

---

## 业务规则

### 发送条件

- ✅ 用户必须是房间参与者
- ✅ 房间状态必须为 `READY`（双方已加入）
- ✅ 消息内容不能为空
- ✅ 必须有活跃的 WebSocket 连接

### 消息增强规则

| 字段 | 来源 | 说明 |
|------|------|------|
| `messageId` | 服务器生成 | UUID 格式，确保唯一性 |
| `roomId` | 服务器查询 | 从连接绑定中获取 |
| `sender` | 服务器查询 | 从房间参与者列表获取完整信息 |
| `createdAt` | 服务器时间 | 使用 `Date.now()`，避免客户端时间差异 |
| `content` | 客户端提供 | 原样保留（验证后） |

### 广播规则

- ✅ 发送给房间内所有参与者（包括发送者）
- ✅ 发送者也接收 `CHAT_RECEIVE`（确保消息显示）
- ✅ 使用服务器生成的完整消息对象
- ✅ 保证消息顺序（单线程处理）

### 为什么发送者也接收消息？

**设计理由**:
1. **状态同步**: 发送者看到的消息与其他人一致（包括 messageId, createdAt）
2. **简化客户端**: 客户端无需区分"发送的消息"和"接收的消息"
3. **时间权威**: 使用服务器时间戳，避免客户端时间不准

---

## 错误处理

### 错误码对照表

| 错误码 | 描述 | 原因 | 客户端处理 |
|--------|------|------|----------|
| `NOT_PARTICIPANT` | 用户不是参与者 | 未加入房间或连接未绑定 | 提示用户先加入房间 |
| `ROOM_NOT_READY` | 房间未就绪 | 只有一个人加入 | 提示等待对方加入 |
| `INVALID_PAYLOAD` | 消息格式错误 | 缺少字段或内容为空 | 检查消息结构 |
| `MESSAGE_SEND_FAILED` | 发送失败 | 服务器内部错误 | 提示用户重试 |

### 错误响应示例

#### 场景 1: 房间未就绪

```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_READY",
    "message": "Cannot send message: room status is WAITING",
    "context": {
      "roomStatus": "WAITING"
    }
  },
  "timestamp": 1737849800000
}
```

#### 场景 2: 用户不是参与者

```json
{
  "type": "ERROR",
  "data": {
    "code": "NOT_PARTICIPANT",
    "message": "User is not a participant of this room",
    "context": {
      "userId": "user-999"
    }
  },
  "timestamp": 1737849800000
}
```

#### 场景 3: 消息内容为空

```json
{
  "type": "ERROR",
  "data": {
    "code": "INVALID_PAYLOAD",
    "message": "Message content cannot be empty",
    "context": {
      "field": "content.text"
    }
  },
  "timestamp": 1737849800000
}
```

---

## 客户端实现

### 完整示例

```typescript
class ChatWebSocketService {
  private ws: WebSocket;

  sendMessage(text: string): void {
    if (!text.trim()) {
      console.error('Message cannot be empty');
      return;
    }

    const message: IChatSendMessage = {
      type: 'CHAT_SEND',
      data: {
        content: {
          type: 'TEXT',
          text: text.trim()
        }
      },
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  private handleChatReceive(message: IChatReceiveMessage): void {
    const { messageId, sender, content, createdAt } = message.data.message;

    console.log(`[${new Date(createdAt).toLocaleTimeString()}] ${sender.nickname}: ${content.text}`);

    // 添加到消息列表
    this.messages.push(message.data.message);

    // 判断是否为自己发送的消息
    const isMine = sender.userId === this.currentUserId;

    // 更新 UI
    this.renderMessage(message.data.message, isMine);
  }

  private renderMessage(msg: IMessage, isMine: boolean): void {
    // UI 渲染逻辑
    const alignment = isMine ? 'right' : 'left';
    // ... 渲染到界面
  }
}
```

### 微信小程序示例

```typescript
// miniprogram/services/chat-service.ts
class ChatService {
  sendMessage(text: string): void {
    if (!text.trim()) {
      wx.showToast({
        title: '消息不能为空',
        icon: 'error'
      });
      return;
    }

    webSocketManager.send({
      type: 'CHAT_SEND',
      data: {
        content: {
          type: 'TEXT',
          text: text.trim()
        }
      }
    });
  }

  handleChatReceive(message: IMessage): void {
    const currentUserId = wx.getStorageSync('userId');
    const isMine = message.sender.userId === currentUserId;

    // 更新页面数据
    const page = getCurrentPages().pop() as any;
    const messages = page.data.messages || [];

    page.setData({
      messages: [...messages, {
        ...message,
        isMine
      }],
      inputText: '' // 清空输入框
    });

    // 滚动到底部
    page.setData({ scrollToBottom: true });
  }

  handleChatError(error: IWSError): void {
    const page = getCurrentPages().pop() as any;

    if (error.code === 'ROOM_NOT_READY') {
      page.setData({
        errorType: 'ROOM_NOT_READY',
        errorMessage: '等待对方加入...'
      });
    } else {
      wx.showToast({
        title: '发送失败',
        icon: 'error'
      });
    }
  }
}
```

### WXML 模板示例

```xml
<!-- pages/chat-room/index.wxml -->
<view class="chat-container">
  <!-- 消息列表 -->
  <scroll-view 
    class="message-list" 
    scroll-y 
    scroll-into-view="{{scrollToBottom ? 'bottom' : ''}}"
  >
    <block wx:for="{{messages}}" wx:key="messageId">
      <view class="message {{item.isMine ? 'mine' : 'other'}}">
        <text class="nickname">{{item.sender.nickname}}</text>
        <view class="content">{{item.content.text}}</view>
        <text class="time">{{item.createdAt}}</text>
      </view>
    </block>
    <view id="bottom"></view>
  </scroll-view>

  <!-- 输入框 -->
  <view class="input-bar">
    <input 
      type="text" 
      value="{{inputText}}"
      bindinput="onInputChange"
      placeholder="输入消息..."
    />
    <button bindtap="onSendMessage">发送</button>
  </view>
</view>
```

---

## 后端实现

### 代码路径

```
backend/src/
├── controllers/ws-controller.ts           # WebSocket 消息路由
├── services/handlers/chat-send.handler.ts # 聊天消息逻辑
└── models/entities/message.ts             # 消息实体
```

### Handler 实现

```typescript
// services/handlers/chat-send.handler.ts
export class ChatSendHandler {
  async handle(
    connectionId: string,
    message: IChatSendMessage
  ): Promise<void> {
    // 1. 获取连接绑定信息
    const connectionData = this.wsManager.getConnection(connectionId);
    if (!connectionData?.userId || !connectionData?.roomId) {
      this.sendError(connectionId, 'NOT_PARTICIPANT');
      return;
    }

    const { userId, roomId } = connectionData;

    // 2. 查找房间
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      this.sendError(connectionId, 'ROOM_NOT_FOUND');
      return;
    }

    // 3. 验证房间状态
    if (room.status !== ERoomStatus.Ready) {
      this.sendError(connectionId, 'ROOM_NOT_READY', {
        roomStatus: room.status
      });
      return;
    }

    // 4. 验证用户是参与者
    const sender = room.participants.find(
      p => p.user.userId === userId
    )?.user;
    if (!sender) {
      this.sendError(connectionId, 'NOT_PARTICIPANT');
      return;
    }

    // 5. 验证消息内容
    const { content } = message.data;
    if (!content.text || !content.text.trim()) {
      this.sendError(connectionId, 'INVALID_PAYLOAD', {
        field: 'content.text'
      });
      return;
    }

    // 6. 构建完整消息对象
    const chatMessage: IMessage = {
      messageId: generateUUID(),
      roomId,
      sender,
      type: EMessageType.Text,
      content,
      createdAt: Date.now()
    };

    // 7. 广播给所有参与者
    this.broadcastChatReceive(room, chatMessage);
  }

  private broadcastChatReceive(room: IRoom, message: IMessage): void {
    const wsMessage: IChatReceiveMessage = {
      type: 'CHAT_RECEIVE',
      data: { message },
      timestamp: Date.now()
    };

    // 发送给房间内所有参与者（包括发送者）
    room.participants.forEach(participant => {
      const connectionId = this.wsManager.getConnectionId(
        participant.user.userId
      );
      if (connectionId) {
        this.wsManager.send(connectionId, wsMessage);
      }
    });
  }
}
```

---

## 测试用例

### 场景 1: 正常发送消息

```javascript
// 发送消息
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hello!"
    }
  },
  "timestamp": 1737849800000
}

// 期望响应（广播给所有参与者）
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": "msg-abc123",
      "roomId": "room-xyz",
      "sender": {
        "userId": "user-001",
        "nickname": "Alice"
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": "Hello!"
      },
      "createdAt": 1737849800050
    }
  },
  "timestamp": 1737849800050
}
```

---

### 场景 2: 房间未就绪（只有一人）

```javascript
// 发送消息
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Is anyone there?"
    }
  },
  "timestamp": 1737849800000
}

// 期望响应
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_READY",
    "message": "Cannot send message: room status is WAITING"
  }
}
```

---

### 场景 3: 消息内容为空

```javascript
// 发送消息
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "   "  // 仅空格
    }
  },
  "timestamp": 1737849800000
}

// 期望响应
{
  "type": "ERROR",
  "data": {
    "code": "INVALID_PAYLOAD",
    "message": "Message content cannot be empty"
  }
}
```

---

## 性能指标

- **消息处理时间**: < 50ms
- **广播延迟**: < 10ms
- **并发消息**: 支持 100+ msg/s per room
- **消息大小限制**: 建议 < 1KB

---

## 扩展功能（未来）

### 消息类型扩展

```typescript
// 当前仅支持 TEXT
type IMessageContent = 
  | { type: 'TEXT'; text: string }
  | { type: 'IMAGE'; url: string; width: number; height: number }  // 未来
  | { type: 'AUDIO'; url: string; duration: number }                // 未来
  | { type: 'EMOJI'; code: string }                                // 未来
```

### 消息历史

- 持久化到数据库（MongoDB）
- 提供查询接口
- 支持分页加载

### 消息状态

- 已发送 / 已送达 / 已读
- 需要客户端回执机制

---

## 常见问题

### Q1: 为什么发送者也接收 CHAT_RECEIVE？

确保发送者看到的消息与其他人一致（包括服务器生成的 ID 和时间戳），简化客户端逻辑。

### Q2: 消息会被持久化吗？

当前版本不持久化，仅实时转发。未来版本会添加消息历史功能。

### Q3: 如何保证消息顺序？

服务器单线程处理同一房间的消息，按接收顺序广播。

### Q4: 消息大小有限制吗？

WebSocket 帧大小理论上没有限制，但建议单条消息 < 1KB，避免网络延迟。

### Q5: 离线消息如何处理？

当前版本不支持离线消息。用户必须在线才能接收消息。

---

## 下一步

了解聊天消息后，推荐阅读：
- [连接管理](04-connection-lifecycle.md) - 连接断开对消息的影响
- [错误处理](05-error-handling.md) - 完整错误码参考
- [数据模型](../data-models.md) - Message 实体详解

---

**相关文档**:
- [返回文档首页](../README.md)
- [加入房间](02-join-room.md)
- [WebSocket 连接](04-connection-lifecycle.md)
