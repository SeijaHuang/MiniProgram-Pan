# 后端模块化架构概览

## 快速参考

### 文件职责一览表

| 文件 | 层级 | 职责 | 禁止事项 |
|------|------|------|----------|
| `routes/room-routes.ts` | 路由层 | URL路径定义，映射到controller | ❌ 业务逻辑 |
| `controllers/room-controller.ts` | 控制器层 | HTTP请求处理，格式化响应 | ❌ 业务逻辑 |
| `controllers/ws-controller.ts` | 控制器层 | WebSocket消息路由，格式化响应 | ❌ 业务逻辑 |
| `services/handlers/join-room-handler.ts` | 业务逻辑层 | 业务规则验证，返回结果 | ❌ 发送响应 |
| `services/handlers/chat-send-handler.ts` | 业务逻辑层 | 业务规则验证，返回结果 | ❌ 发送响应 |
| `services/room-manager.ts` | 领域服务层 | 房间领域逻辑 | ❌ HTTP/WS协议 |
| `services/connection-manager.ts` | 领域服务层 | 连接管理逻辑 | ❌ HTTP/WS协议 |
| `models/*.ts` | 模型层 | 数据结构定义 | ❌ 任何逻辑 |
| `types/*.ts` | 类型层 | 类型定义 | ❌ 任何逻辑 |

## 数据流向

### HTTP 请求：创建房间

```
用户 → POST /room/create
         ↓
    [app.ts] Express配置
         ↓
    [routes/room-routes.ts] 路由定义
         ↓
    [controllers/room-controller.ts] 控制器
         | - 验证请求
         | - 调用服务
         ↓
    [services/room-manager.ts] 领域服务
         | - 创建房间
         | - 生成roomCode
         ↓
    [models/room.ts] Room实体
         ↓
    返回 ← { success: true, data: { room } }
```

### WebSocket 消息：加入房间

```
客户端 → JOIN_ROOM { roomCode, user }
         ↓
    [ws.ts] WebSocket配置
         ↓
    [controllers/ws-controller.ts] WebSocket控制器
         | - 解析消息
         | - 路由到handler
         ↓
    [services/handlers/join-room-handler.ts] 业务逻辑
         | - 验证roomCode
         | - 验证user
         | - 返回结果 (不发送！)
         ↓
    [services/room-manager.ts] 领域服务
         | - 检查房间状态
         | - 添加参与者
         | - 更新房间状态
         ↓
    [services/connection-manager.ts] 连接管理
         | - 绑定连接
         ↓
    返回结果 ← { success: true, room }
         ↓
    [controllers/ws-controller.ts] 格式化响应
         | - 广播 JOIN_ACK
         ↓
    所有参与者 ← JOIN_ACK { room }
```

### WebSocket 消息：发送聊天

```
客户端 → CHAT_SEND { content: { type, text } }
         ↓
    [ws.ts] WebSocket配置
         ↓
    [controllers/ws-controller.ts] WebSocket控制器
         ↓
    [services/handlers/chat-send-handler.ts] 业务逻辑
         | - 验证用户已加入
         | - 验证房间状态 (READY)
         | - 验证内容格式
         | - 创建消息实体
         | - 返回结果 (不发送！)
         ↓
    返回结果 ← { success: true, message, roomId }
         ↓
    [controllers/ws-controller.ts] 格式化响应
         | - 广播 CHAT_RECEIVE
         ↓
    所有参与者 ← CHAT_RECEIVE { message }
```

## 关键改进点

### ✅ 之前的问题

```typescript
// ❌ app.ts - 业务逻辑和路由混在一起
app.post('/room/create', (req, res) => {
    const room = roomManager.createRoom();  // 业务逻辑在路由里！
    res.json({ success: true, data: { room } });
});

// ❌ handlers - 直接发送WebSocket响应
export function handleJoinRoom(...): void {
    connectionManager.sendToConnection(...);  // handler发送响应！
}
```

### ✅ 现在的解决方案

```typescript
// ✅ routes/room-routes.ts - 纯路由定义
router.post('/create', RoomController.createRoom);

// ✅ controllers/room-controller.ts - 控制器处理请求/响应
static createRoom(req, res) {
    const room = roomManager.createRoom();  // 调用服务
    res.json({ success: true, data: { room } });  // 格式化响应
}

// ✅ handlers - 返回结果，不发送响应
export function handleJoinRoom(...): TJoinRoomHandlerResult {
    return { success: true, room };  // 只返回结果！
}

// ✅ controllers/ws-controller.ts - 控制器处理响应格式化
const result = handleJoinRoom(...);
if (result.success) {
    connectionManager.broadcastToRoom(...);  // controller发送响应
}
```

## 分层优势

### 1. 独立测试

```typescript
// ✅ 可以直接测试业务逻辑，不需要Mock HTTP/WebSocket
describe('handleJoinRoom', () => {
    it('should reject invalid roomCode', () => {
        const result = handleJoinRoom(manager, 'conn1', invalidMessage);
        expect(result.success).toBe(false);
        expect(result.code).toBe(EWSErrorCode.InvalidPayload);
    });
});
```

### 2. 业务逻辑复用

```typescript
// ✅ 同一个业务逻辑可用于不同协议
// HTTP endpoint
app.get('/room/:code', (req, res) => {
    const result = handleJoinRoom(...);  // 复用相同逻辑
    res.json(result);
});

// WebSocket
ws.on('message', (msg) => {
    const result = handleJoinRoom(...);  // 复用相同逻辑
    ws.send(result);
});

// gRPC (未来)
grpc.join = (call, callback) => {
    const result = handleJoinRoom(...);  // 复用相同逻辑
    callback(null, result);
};
```

### 3. 易于维护

```typescript
// 需求变更：修改房间加入规则
// ✅ 只需修改一个文件：services/handlers/join-room-handler.ts
// ❌ 之前需要修改多个文件：app.ts, ws.ts, 可能还有其他地方
```

## 添加新功能示例

### 场景：添加"离开房间"功能

#### 步骤 1: 定义类型

```typescript
// types/ws-messages.ts
export enum EWSMessageType {
    LeaveRoom = 'LEAVE_ROOM',      // 新增
    LeaveAck = 'LEAVE_ACK',        // 新增
}

export interface ILeaveRoomMessage extends IWSMessage {
    type: EWSMessageType.LeaveRoom;
    data: {
        userId: string;
    };
}
```

#### 步骤 2: 创建业务逻辑 Handler

```typescript
// services/handlers/leave-room-handler.ts
export interface ILeaveRoomResult {
    success: true;
    room: IRoom;
    userId: string;
}

export function handleLeaveRoom(
    connectionManager: ConnectionManager,
    connectionId: string,
    message: ILeaveRoomMessage
): ILeaveRoomResult | ILeaveRoomError {
    // 验证
    const connection = connectionManager.getConnection(connectionId);
    if (!connection || !connection.roomId) {
        return { 
            success: false, 
            code: EWSErrorCode.NotParticipant,
            message: 'Not in a room'
        };
    }
    
    // 调用领域服务
    const result = roomManager.leaveRoom(connection.roomId, connection.userId);
    
    // 返回结果（不发送响应）
    return result;
}
```

#### 步骤 3: 添加领域服务方法

```typescript
// services/room-manager.ts
leaveRoom(roomId: string, userId: string): Result {
    const room = this.rooms.get(roomId);
    // ... 领域逻辑
    return { success: true, room };
}
```

#### 步骤 4: 更新 Controller

```typescript
// controllers/ws-controller.ts
case EWSMessageType.LeaveRoom:
    WebSocketController.handleLeaveRoomMessage(
        connectionId,
        message as ILeaveRoomMessage
    );
    break;

private static handleLeaveRoomMessage(
    connectionId: string,
    message: ILeaveRoomMessage
): void {
    const result = handleLeaveRoom(connectionManager, connectionId, message);
    
    if (!result.success) {
        WebSocketController.sendError(connectionId, result.code, result.message);
        return;
    }
    
    // 广播 LEAVE_ACK
    connectionManager.broadcastToRoom(result.room.roomId, {
        type: EWSMessageType.LeaveAck,
        data: { room: result.room, userId: result.userId },
        timestamp: Date.now(),
    });
}
```

#### 完成！

- ✅ 职责清晰：类型 → Handler → Service → Controller
- ✅ 可测试：每层都可独立测试
- ✅ 可扩展：不影响现有功能

## 总结

### 核心原则

1. **Routes**: 只定义路径，不写逻辑
2. **Controllers**: 只处理请求/响应，不写业务逻辑
3. **Handlers**: 只写业务逻辑，不发送响应
4. **Services**: 只写领域逻辑，不关心传输协议
5. **Models**: 只定义数据，不写任何逻辑

### 记忆口诀

```
路由指路不干活，        (Routes: 路径定义)
控制收发不决策，        (Controllers: 请求/响应)
处理验证不通讯，        (Handlers: 业务逻辑)
服务专注不越界，        (Services: 领域逻辑)
模型纯净不带刺。        (Models: 数据定义)
```

### 下一步

- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 添加 API 文档
- [ ] 考虑添加中间件层（认证、日志等）
- [ ] 考虑添加数据持久化层
