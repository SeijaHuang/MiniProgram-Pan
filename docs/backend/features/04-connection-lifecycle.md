# 功能文档:连接生命周期管理

## 概述

WebSocket 连接的完整生命周期管理，包括连接建立、消息路由、连接断开和资源清理。

**协议**: WebSocket  
**路径**: `ws://localhost:8080/ws`

---

## 连接生命周期

### 状态图

```
[未连接]
   ↓ connect()
[已连接] → connectionId 分配
   ↓ JOIN_ROOM 消息
[已绑定] → userId, roomId 绑定
   ↓ 消息收发
[活跃状态]
   ↓ disconnect() / 网络断开
[清理中] → 移除用户、清理连接
   ↓
[已断开]
```

---

## 连接建立

### 流程图

```
客户端                     服务器
  |                          |
  |-- WebSocket 连接 -------->|
  |                          |-- 分配 connectionId
  |                          |-- 保存连接对象
  |                          |-- 注册事件监听
  |<----- onopen 事件 -------|
  |                          |
  |-- 发送 JOIN_ROOM -------->|
  |                          |-- 绑定 userId
  |                          |-- 绑定 roomId
  |                          |
  [连接就绪，可以收发消息]
```

### 详细步骤

1. **客户端发起连接**
   ```typescript
   const ws = new WebSocket('ws://localhost:8080/ws');
   ```

2. **服务器接受连接**
   - 生成唯一 `connectionId`（UUID）
   - 创建 `IConnectionData` 对象
   - 保存到连接池（Map）
   - 注册事件监听器（message, close, error）

3. **连接未绑定状态**
   - 此时仅有 `connectionId` 和 `socket`
   - `userId` 和 `roomId` 为空
   - 不能发送聊天消息（仅能发送 JOIN_ROOM）

4. **发送 JOIN_ROOM 消息**
   - 客户端发送加入房间请求
   - 服务器验证成功后绑定 `userId` 和 `roomId`
   - 连接进入"已绑定"状态

---

## 连接数据结构

### IConnectionData

```typescript
interface IConnectionData {
  connectionId: string;   // 唯一连接标识
  socket: WebSocket;      // 原生 WebSocket 对象
  userId?: string;        // 用户ID（加入房间后绑定）
  roomId?: string;        // 房间ID（加入房间后绑定）
}
```

### 索引结构

服务器维护多个索引以支持快速查询：

```typescript
class WebSocketManager {
  private connections: Map<string, IConnectionData>;  // connectionId → Data
  private userConnections: Map<string, string>;       // userId → connectionId
  private roomConnections: Map<string, Set<string>>;  // roomId → connectionIds
}
```

**用途**:
- `connections`: 根据 connectionId 查找连接
- `userConnections`: 根据 userId 查找连接
- `roomConnections`: 根据 roomId 查找所有连接（用于广播）

---

## 消息路由

### 路由流程

```
WebSocket 消息到达
   ↓
提取 connectionId
   ↓
解析消息 JSON
   ↓
根据 message.type 路由
   ↓
调用对应 Handler
   ↓
Handler 处理业务逻辑
   ↓
发送响应消息
```

### Controller 实现

```typescript
// controllers/ws-controller.ts
export class WSController {
  handleMessage(connectionId: string, data: string): void {
    try {
      // 1. 解析消息
      const message = JSON.parse(data) as IWSMessage;

      // 2. 路由到对应 Handler
      switch (message.type) {
        case 'JOIN_ROOM':
          this.joinRoomHandler.handle(connectionId, message);
          break;

        case 'CHAT_SEND':
          this.chatSendHandler.handle(connectionId, message);
          break;

        default:
          this.sendError(connectionId, 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.sendError(connectionId, 'INVALID_PAYLOAD');
    }
  }
}
```

---

## 连接断开

### 断开场景

| 场景 | 原因 | 服务器行为 |
|------|------|----------|
| 客户端主动断开 | 用户关闭页面 | 触发 `onclose` 事件 |
| 网络异常 | 网络中断 | 触发 `onerror` 和 `onclose` |
| 服务器主动断开 | 检测到异常 | 调用 `socket.close()` |
| 超时（未来） | 心跳超时 | 服务器主动关闭 |

### 清理流程

```
连接断开事件触发
   ↓
获取 connectionData
   ↓
提取 userId 和 roomId
   ↓
从房间移除用户
   ↓
通知其他参与者（可选）
   ↓
删除连接索引
   ↓
释放 WebSocket 对象
```

### 实现代码

```typescript
// services/websocket/ws-manager.ts
export class WebSocketManager {
  handleDisconnect(connectionId: string): void {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      return;
    }

    const { userId, roomId } = connectionData;

    // 1. 从房间移除用户
    if (userId && roomId) {
      this.removeUserFromRoom(userId, roomId);
    }

    // 2. 删除连接索引
    this.connections.delete(connectionId);

    if (userId) {
      this.userConnections.delete(userId);
    }

    if (roomId) {
      const roomConns = this.roomConnections.get(roomId);
      roomConns?.delete(connectionId);

      // 如果房间没有连接了，删除索引
      if (roomConns?.size === 0) {
        this.roomConnections.delete(roomId);
      }
    }

    console.log(`Connection ${connectionId} disconnected`);
  }

  private async removeUserFromRoom(
    userId: string, 
    roomId: string
  ): Promise<void> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      return;
    }

    // 移除参与者
    room.participants = room.participants.filter(
      p => p.user.userId !== userId
    );

    // 如果房间为空，标记为关闭
    if (room.participants.length === 0) {
      room.status = ERoomStatus.Closed;
    }
    // 如果只剩一个人，变回 WAITING
    else if (room.participants.length === 1) {
      room.status = ERoomStatus.Waiting;
    }

    await this.roomRepository.save(room);

    // 通知其他参与者（可选）
    this.notifyRoomUpdate(room);
  }
}
```

---

## 连接绑定

### 绑定时机

连接绑定发生在 `JOIN_ROOM` 消息处理成功后：

```typescript
// services/handlers/join-room.handler.ts
async handle(connectionId: string, message: IJoinRoomMessage) {
  // ... 验证房间、添加用户等逻辑

  // 绑定连接
  this.wsManager.bindConnection(
    connectionId, 
    user.userId, 
    room.roomId
  );

  // ... 广播 JOIN_ACK
}
```

### 绑定实现

```typescript
// services/websocket/ws-manager.ts
export class WebSocketManager {
  bindConnection(
    connectionId: string, 
    userId: string, 
    roomId: string
  ): void {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      throw new Error('Connection not found');
    }

    // 更新连接数据
    connectionData.userId = userId;
    connectionData.roomId = roomId;

    // 更新索引
    this.userConnections.set(userId, connectionId);

    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(connectionId);

    console.log(`Connection ${connectionId} bound to user ${userId} in room ${roomId}`);
  }
}
```

---

## 消息发送

### 单播（Unicast）

发送消息给特定连接：

```typescript
send(connectionId: string, message: IWSMessage): void {
  const connectionData = this.connections.get(connectionId);
  if (!connectionData) {
    console.warn(`Connection ${connectionId} not found`);
    return;
  }

  const { socket } = connectionData;
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn(`Socket ${connectionId} not open`);
  }
}
```

### 广播（Broadcast）

发送消息给房间内所有连接：

```typescript
broadcast(roomId: string, message: IWSMessage): void {
  const connectionIds = this.roomConnections.get(roomId);
  if (!connectionIds) {
    console.warn(`No connections for room ${roomId}`);
    return;
  }

  connectionIds.forEach(connectionId => {
    this.send(connectionId, message);
  });
}
```

---

## 错误处理

### 连接错误

```typescript
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  // 错误会触发 close 事件，在 close 中统一清理
});
```

### 消息解析错误

```typescript
try {
  const message = JSON.parse(data);
} catch (error) {
  this.sendError(connectionId, 'INVALID_PAYLOAD', {
    reason: 'Invalid JSON format'
  });
}
```

### 未绑定连接发送消息

```typescript
if (message.type === 'CHAT_SEND') {
  const connectionData = this.connections.get(connectionId);
  if (!connectionData?.userId || !connectionData?.roomId) {
    this.sendError(connectionId, 'NOT_PARTICIPANT', {
      reason: 'Connection not bound to user/room'
    });
    return;
  }
}
```

---

## 客户端实现

### 微信小程序 WebSocket Manager

```typescript
// miniprogram/services/websocket-manager.ts
class WebSocketManager {
  private socket: WechatMiniprogram.SocketTask | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  connect(): void {
    this.socket = wx.connectSocket({
      url: 'ws://localhost:8080/ws'
    });

    this.socket.onOpen(() => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.onMessage((res) => {
      const message = JSON.parse(res.data as string);
      this.handleMessage(message);
    });

    this.socket.onClose(() => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.attemptReconnect();
    });

    this.socket.onError((error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close({
        code: 1000,
        reason: 'User initiated disconnect'
      });
      this.socket = null;
      this.isConnected = false;
    }
  }

  send(message: IWSMessage): void {
    if (!this.isConnected || !this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.send({
      data: JSON.stringify({
        ...message,
        timestamp: Date.now()
      })
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      wx.showToast({
        title: '连接失败',
        icon: 'error'
      });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  private handleMessage(message: IWSMessage): void {
    switch (message.type) {
      case 'JOIN_ACK':
        this.handleJoinAck(message);
        break;
      case 'CHAT_RECEIVE':
        this.handleChatReceive(message);
        break;
      case 'ERROR':
        this.handleError(message);
        break;
    }
  }
}

export const webSocketManager = new WebSocketManager();
```

---

## 重连机制

### 策略

- **指数退避**: 第1次等待1秒，第2次2秒，第3次4秒...
- **最大延迟**: 10秒
- **最大尝试**: 5次
- **用户提示**: 达到最大尝试后提示用户

### 实现

```typescript
private attemptReconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    this.handleMaxReconnectReached();
    return;
  }

  const delay = Math.min(
    1000 * Math.pow(2, this.reconnectAttempts), 
    10000
  );
  this.reconnectAttempts++;

  setTimeout(() => {
    this.connect();
    
    // 如果连接成功，重新加入房间
    if (this.lastRoomCode) {
      this.rejoinRoom(this.lastRoomCode);
    }
  }, delay);
}
```

---

## 性能优化

### 连接池管理

- **内存占用**: 每个连接约 1KB（估算）
- **最大连接数**: 1000+（根据服务器配置）
- **超时清理**: 可选实现心跳机制

### 消息缓冲

对于高频消息，可以使用缓冲：

```typescript
private messageQueue: IWSMessage[] = [];
private flushInterval: NodeJS.Timeout;

constructor() {
  // 每 100ms 批量发送
  this.flushInterval = setInterval(() => {
    this.flushMessages();
  }, 100);
}

send(message: IWSMessage): void {
  this.messageQueue.push(message);
}

private flushMessages(): void {
  if (this.messageQueue.length === 0) return;

  const batch = this.messageQueue.splice(0, 10);  // 最多10条
  batch.forEach(msg => this.sendImmediate(msg));
}
```

---

## 监控指标

### 连接状态

```typescript
getStats(): IConnectionStats {
  return {
    totalConnections: this.connections.size,
    boundConnections: Array.from(this.connections.values())
      .filter(c => c.userId && c.roomId).length,
    activeRooms: this.roomConnections.size
  };
}
```

### 日志记录

```typescript
console.log(`[WS] Connection ${connectionId} established`);
console.log(`[WS] User ${userId} joined room ${roomId}`);
console.log(`[WS] Message ${message.type} from ${userId}`);
console.log(`[WS] Connection ${connectionId} closed`);
```

---

## 安全考虑

### 连接验证

- ✅ 连接建立时无需认证（会话级别）
- ✅ JOIN_ROOM 时验证房间代码
- ❌ 暂无 token 认证机制

### DoS 防护

- ⏳ 限制每个 IP 的连接数（未实现）
- ⏳ 消息频率限制（未实现）
- ⏳ 自动断开空闲连接（未实现）

---

## 常见问题

### Q1: 连接断开后房间会怎样？

用户会被自动移除。如果房间为空，状态变为 `CLOSED`。

### Q2: 重连后需要重新加入房间吗？

是的，需要重新发送 `JOIN_ROOM` 消息。

### Q3: 如何检测连接状态？

客户端可以监听 `onOpen`, `onClose` 事件。服务器可以通过 `socket.readyState` 检查。

### Q4: 为什么要维护多个索引？

快速查询：
- 根据 connectionId 查连接
- 根据 userId 查连接
- 根据 roomId 查所有连接（广播）

---

## 下一步

了解连接管理后，推荐阅读：
- [错误处理](05-error-handling.md) - 完整错误码参考
- [聊天消息](03-chat-messaging.md) - 消息收发依赖连接绑定
- [数据模型](../data-models.md) - IConnectionData 详解

---

**相关文档**:
- [返回文档首页](../README.md)
- [加入房间](02-join-room.md)
- [WebSocket 规则](.cursor/rules/04-websocket.md)
