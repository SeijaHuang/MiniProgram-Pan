# 功能文档：加入房间

## 概述

用户通过6位房间代码加入已创建的房间，使用 WebSocket 协议进行身份验证和状态同步。

**协议**: WebSocket  
**消息类型**: `JOIN_ROOM` (Client → Server), `JOIN_ACK` (Server → Client)

---

## 业务流程

### 流程图

```
客户端                     服务器                    房间内其他用户
  |                          |                            |
  |-- WebSocket 连接 -------->|                            |
  |                          |                            |
  |-- JOIN_ROOM 消息 -------->|                            |
  |                          |-- 验证房间代码              |
  |                          |-- 检查房间状态              |
  |                          |-- 检查参与者数量            |
  |                          |-- 添加用户到房间            |
  |                          |-- 更新房间状态（如需要）    |
  |                          |                            |
  |<----- JOIN_ACK ----------|------ JOIN_ACK ----------->|
  |    (广播给所有参与者)     |                            |
```

### 详细步骤

1. **建立 WebSocket 连接**
   - 客户端连接到 `ws://localhost:8080/ws`
   - 服务器分配 `connectionId`

2. **发送加入请求**
   - 客户端发送 `JOIN_ROOM` 消息
   - 包含房间代码和用户信息

3. **服务器验证**
   - ✅ 房间代码是否存在
   - ✅ 房间状态是否允许加入（WAITING 或 READY）
   - ✅ 参与者数量是否小于2
   - ✅ 用户是否已在房间中

4. **更新房间状态**
   - 添加用户到 `participants` 列表
   - 记录 `joinedAt` 时间戳
   - 如果是第二个用户，更新状态为 `READY`

5. **广播确认消息**
   - 向房间内所有参与者发送 `JOIN_ACK`
   - 包含更新后的完整房间信息

---

## 消息协议

### JOIN_ROOM (Client → Server)

**方向**: 客户端 → 服务器  
**用途**: 请求加入指定房间

```typescript
{
  type: "JOIN_ROOM";
  data: {
    roomCode: string;     // 6位房间代码
    nickname: string;     // 用户昵称（前端只传昵称，userId 由后端生成）
  };
  timestamp: number;      // 客户端时间戳
}
```

**示例**:
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "nickname": "Bob"
  },
  "timestamp": 1737849600000
}
```

---

### JOIN_ACK (Server → Client)

**方向**: 服务器 → 所有参与者（广播）  
**用途**: 确认用户加入，同步房间状态

```typescript
{
  type: "JOIN_ACK";
  data: {
    selfUserId: string; // 当前连接者自己的 userId（后端生成）
    room: {
      roomId: string;
      roomCode: string;
      hostUserId: string;
      participants: IParticipant[];  // 更新后的参与者列表
      status: ERoomStatus;           // 更新后的房间状态
      createdAt: number;
    }
  };
  timestamp: number;  // 服务器时间戳
}
```

**示例 1: 第一个用户加入（房主）**
```json
{
  "type": "JOIN_ACK",
  "data": {
    "selfUserId": "user-12345",
    "room": {
      "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "roomCode": "A1B2C3",
      "hostUserId": "user-12345",
      "participants": [
        {
          "user": {
            "userId": "user-12345",
            "nickname": "Alice"
          },
          "joinedAt": 1737849600000
        }
      ],
      "status": "WAITING",
      "createdAt": 1737849500000
    }
  },
  "timestamp": 1737849600050
}
```

**示例 2: 第二个用户加入（访客）**
```json
{
  "type": "JOIN_ACK",
  "data": {
    "selfUserId": "user-67890",
    "room": {
      "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "roomCode": "A1B2C3",
      "hostUserId": "user-12345",
      "participants": [
        {
          "user": {
            "userId": "user-12345",
            "nickname": "Alice"
          },
          "joinedAt": 1737849600000
        },
        {
          "user": {
            "userId": "user-67890",
            "nickname": "Bob"
          },
          "joinedAt": 1737849700000
        }
      ],
      "status": "READY",
      "createdAt": 1737849500000
    }
  },
  "timestamp": 1737849700050
}
```

---

## 业务规则

### 加入条件

- ✅ 房间代码必须存在
- ✅ 房间状态为 `WAITING` 或 `READY`
- ✅ 参与者数量 < 2
- ✅ 用户未在房间中（防止重复加入）

### 状态转换规则

| 当前状态 | 参与者数量 | 加入后状态 |
|---------|-----------|-----------|
| WAITING | 0 → 1 | WAITING |
| WAITING | 1 → 2 | **READY** |
| READY | 2 | 拒绝加入 (ROOM_FULL) |
| CLOSED | - | 拒绝加入 (ROOM_CLOSED) |

### 广播规则

- ✅ `JOIN_ACK` 发送给房间内所有参与者（包括刚加入的用户）
- ✅ 确保所有客户端状态同步
- ✅ 房主和访客接收相同的房间数据

---

## 错误处理

### ERROR 消息格式

**方向**: 服务器 → 客户端  
**用途**: 通知加入失败原因

```typescript
{
  type: "ERROR";
  data: {
    code: EWSErrorCode;
    message: string;
    context?: {
      roomCode?: string;
      userId?: string;
    }
  };
  timestamp: number;
}
```

### 错误码对照表

| 错误码 | 描述 | 原因 | 客户端处理 |
|--------|------|------|----------|
| `ROOM_NOT_FOUND` | 房间不存在 | 房间代码错误或已失效 | 提示用户重新输入代码 |
| `ROOM_FULL` | 房间已满 | 已有2名参与者 | 提示用户房间已满 |
| `ROOM_CLOSED` | 房间已关闭 | 房间状态为 CLOSED | 提示用户房间已关闭 |
| `ALREADY_JOINED` | 用户已在房间 | 重复加入请求 | 忽略或提示已加入 |
| `INVALID_PAYLOAD` | 消息格式错误 | 缺少必填字段 | 检查消息结构 |

### 错误响应示例

```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with code A1B2C3 does not exist",
    "context": {
      "roomCode": "A1B2C3"
    }
  },
  "timestamp": 1737849700000
}
```

---

## 客户端实现

### 完整示例

```typescript
class RoomWebSocketService {
  private ws: WebSocket;

  connect() {
    this.ws = new WebSocket('ws://localhost:8080/ws');

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  joinRoom(roomCode: string, nickname: string) {
    const message = {
      type: 'JOIN_ROOM',
      data: { roomCode, nickname },
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(message: IWSMessage) {
    switch (message.type) {
      case 'JOIN_ACK':
        this.onJoinSuccess(message.data.room);
        break;

      case 'ERROR':
        this.onJoinError(message.data);
        break;
    }
  }

  private onJoinSuccess(data: { selfUserId: string; room: IRoom }) {
    const { selfUserId, room } = data;
    console.log('Joined room:', room.roomCode);
    console.log('Self userId:', selfUserId);
    console.log('Participants:', room.participants.length);
    console.log('Status:', room.status);

    // 更新 UI 状态
    if (room.status === 'READY') {
      console.log('Room is ready! Both users joined.');
    }
  }

  private onJoinError(error: IWSError) {
    console.error('Failed to join room:', error.message);

    switch (error.code) {
      case 'ROOM_NOT_FOUND':
        // 提示用户房间代码错误
        break;
      case 'ROOM_FULL':
        // 提示用户房间已满
        break;
      case 'ROOM_CLOSED':
        // 提示用户房间已关闭
        break;
    }
  }
}
```

### 微信小程序示例

```typescript
// miniprogram/services/room-websocket-service.ts
class RoomWebSocketService {
  joinRoom(roomCode: string): void {
    const nickname = this.getCurrentNickname();

    webSocketManager.send({
      type: 'JOIN_ROOM',
      data: { roomCode, nickname }
    });
  }

  private handleJoinAck(data: { selfUserId: string; room: IRoom }): void {
    const { selfUserId, room } = data;
    // 更新页面数据
    const page = getCurrentPages().pop() as any;
    page.setData({
      room,
      selfUserId,
      isReady: room.status === 'READY'
    });

    if (room.status === 'READY') {
      wx.showToast({
        title: '对方已加入',
        icon: 'success'
      });
    }
  }

  private handleJoinError(error: IWSError): void {
    const page = getCurrentPages().pop() as any;
    page.setData({
      errorType: error.code,
      errorMessage: error.message
    });
  }
}
```

---

## 后端实现

### 代码路径

```
backend/src/
├── controllers/ws-controller.ts          # WebSocket 消息路由
├── services/handlers/join-room.handler.ts # 加入房间逻辑
└── services/websocket/ws-manager.ts      # 连接管理
```

### Handler 实现

```typescript
// services/handlers/join-room.handler.ts
export class JoinRoomHandler {
  async handle(
    connectionId: string,
    message: IJoinRoomMessage
  ): Promise<void> {
    const { roomCode, nickname } = message.data;

    // 1. 查找房间
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) {
      this.sendError(connectionId, 'ROOM_NOT_FOUND');
      return;
    }

    // 2. 验证房间状态
    if (room.status === ERoomStatus.Closed) {
      this.sendError(connectionId, 'ROOM_CLOSED');
      return;
    }

    // 3. 检查参与者数量
    if (room.participants.length >= 2) {
      this.sendError(connectionId, 'ROOM_FULL');
      return;
    }

    // 4. 生成 userId（后端权威）
    const userId = uuidv4();

    // 5. 添加参与者
    room.participants.push({
      user: { userId, nickname },
      joinedAt: Date.now()
    });

    // 6. 更新房间状态
    if (room.participants.length === 2) {
      room.status = ERoomStatus.Ready;
    }

    // 7. 保存到仓储
    await this.roomRepository.save(room);

    // 8. 绑定连接与用户/房间
    this.wsManager.bindConnection(connectionId, userId, room.roomId);

    // 9. 广播给所有参与者
    this.broadcastJoinAck(room);
  }

  private broadcastJoinAck(room: IRoom): void {
    // 发送给房间内所有参与者（每个连接拿到各自的 selfUserId）
    room.participants.forEach(participant => {
      const connectionId = this.wsManager.getConnectionId(
        participant.user.userId
      );
      if (!connectionId) {
        return;
      }

      const message: IJoinAckMessage = {
        type: 'JOIN_ACK',
        data: { selfUserId: participant.user.userId, room },
        timestamp: Date.now()
      };
      this.wsManager.send(connectionId, message);
    });
  }
}
```

---

## 测试用例

### 场景 1: 房主加入（第一个用户）

```javascript
// 发送消息
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "nickname": "Alice"
  },
  "timestamp": 1737849600000
}

// 期望响应
{
  "type": "JOIN_ACK",
  "data": {
    "selfUserId": "<generated-u1>",
    "room": {
      "participants": [{ "user": { "userId": "<generated-u1>" } }],
      "status": "WAITING"
    }
  }
}
```

---

### 场景 2: 访客加入（第二个用户）

```javascript
// 发送消息
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "nickname": "Bob"
  },
  "timestamp": 1737849700000
}

// 期望响应（广播给双方）
{
  "type": "JOIN_ACK",
  "data": {
    "selfUserId": "<generated-u2>", // 注意：广播给不同客户端时，该字段不同
    "room": {
      "participants": [
        { "user": { "userId": "<generated-u1>" } },
        { "user": { "userId": "<generated-u2>" } }
      ],
      "status": "READY"
    }
  }
}
```

---

### 场景 3: 第三个用户尝试加入（失败）

```javascript
// 发送消息
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "nickname": "Charlie"
  },
  "timestamp": 1737849800000
}

// 期望响应
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_FULL",
    "message": "Room is full (max 2 participants)"
  }
}
```

---

### 场景 4: 房间代码不存在（失败）

```javascript
// 发送消息
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "INVALID",
    "nickname": "Dave"
  },
  "timestamp": 1737849900000
}

// 期望响应
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with code INVALID does not exist"
  }
}
```

---

## 性能指标

- **消息处理时间**: < 50ms
- **广播延迟**: < 10ms
- **并发加入**: 支持多个房间同时加入

---

## 安全考虑

- ✅ 验证房间代码存在性
- ✅ 严格限制参与者数量（最多2人）
- ✅ 防止重复加入
- ❌ 无需身份认证（会话级别）

---

## 常见问题

### Q1: 房主必须先加入吗？

不是必须的。房间创建后任何人都可以通过代码加入（包括房主）。

### Q2: 加入顺序会影响角色吗？

第一个加入的用户是房主（hostUserId），但业务逻辑上无特殊权限。

### Q3: JOIN_ACK 为什么要广播？

确保所有参与者状态同步，当第二个用户加入时，第一个用户也能立即知道。

### Q4: 如果连接断开了怎么办？

参与者会被自动移除。详见 [连接管理文档](04-connection-lifecycle.md)。

---

## 下一步

加入房间后，推荐阅读：
- [聊天消息](03-chat-messaging.md) - 如何发送和接收消息
- [连接管理](04-connection-lifecycle.md) - 连接断开处理
- [错误处理](05-error-handling.md) - 完整错误码参考

---

**相关文档**:
- [返回文档首页](../README.md)
- [创建房间](01-room-creation.md)
- [数据模型](../data-models.md)
