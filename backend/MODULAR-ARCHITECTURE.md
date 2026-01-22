# Backend Modular Architecture

## 概述

后端采用清晰的分层架构，将业务逻辑、控制器和路由完全分离。遵循 SOLID 原则和关注点分离原则。

## 架构分层

```
┌─────────────────────────────────────────────┐
│             Entry Points                     │
│  (index.ts, app.ts, ws.ts)                  │
│  - 服务器配置和初始化                         │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│            Routes Layer                      │
│  (routes/room-routes.ts)                    │
│  - URL 路径定义                              │
│  - HTTP 方法映射                             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Controllers Layer                   │
│  (controllers/*)                             │
│  - 请求验证                                  │
│  - 调用业务逻辑                              │
│  - 格式化响应                                │
│  - 错误处理                                  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│      Business Logic Layer                    │
│  (services/handlers/*)                       │
│  - 业务规则验证                              │
│  - 调用领域服务                              │
│  - 返回结果（不发送响应）                     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│        Domain Services Layer                 │
│  (services/room-manager.ts,                  │
│   services/connection-manager.ts)            │
│  - 领域逻辑                                  │
│  - 状态管理                                  │
│  - 数据持久化                                │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Models/Types Layer                  │
│  (models/*, types/*)                         │
│  - 数据结构定义                              │
│  - 类型定义                                  │
└─────────────────────────────────────────────┘
```

## 目录结构

```
backend/src/
├── index.ts                    # 应用入口
├── app.ts                      # Express 配置
├── ws.ts                       # WebSocket 配置
│
├── routes/                     # 路由定义层
│   └── room-routes.ts          # Room 路由定义
│
├── controllers/                # 控制器层
│   ├── room-controller.ts      # HTTP 请求处理
│   └── ws-controller.ts        # WebSocket 消息路由
│
├── services/                   # 服务层
│   ├── room-manager.ts         # 房间领域服务
│   ├── connection-manager.ts   # 连接管理服务
│   └── handlers/               # 业务逻辑处理器
│       ├── join-room-handler.ts    # 加入房间业务逻辑
│       └── chat-send-handler.ts    # 发送消息业务逻辑
│
├── models/                     # 领域模型
│   ├── room.ts
│   ├── user.ts
│   └── message.ts
│
├── types/                      # 类型定义
│   ├── http.ts
│   ├── ws-messages.ts
│   └── common.ts
│
├── constants/                  # 常量配置
│   └── config.ts
│
├── middlewares/                # 中间件
│
└── utils/                      # 工具函数
    └── env-loader.ts
```

## 各层职责

### 1. Routes Layer (路由层)

**文件**: `routes/room-routes.ts`

**职责**:
- 定义 URL 路径和 HTTP 方法
- 映射路由到控制器方法
- **不包含**任何业务逻辑

**示例**:
```typescript
router.post('/create', RoomController.createRoom);
```

### 2. Controllers Layer (控制器层)

**文件**: 
- `controllers/room-controller.ts` - HTTP 控制器
- `controllers/ws-controller.ts` - WebSocket 控制器

**职责**:
- 验证请求格式
- 调用业务逻辑层
- 格式化响应（成功/错误）
- 处理异常
- **不包含**业务逻辑

**示例**:
```typescript
// HTTP Controller
static createRoom(req, res) {
    const room = roomManager.createRoom();  // 调用服务
    res.status(201).json({ success: true, data: { room } });  // 格式化响应
}

// WebSocket Controller
static handleMessage(connectionId, data) {
    const result = handleJoinRoom(...);  // 调用业务逻辑
    if (result.success) {
        connectionManager.broadcast(...);  // 格式化并发送响应
    }
}
```

### 3. Business Logic Layer (业务逻辑层)

**文件**: `services/handlers/*`

**职责**:
- 实现业务规则验证
- 调用领域服务
- 返回结构化结果（成功/失败）
- **不直接**发送 HTTP/WebSocket 响应

**返回值类型**:
```typescript
// 成功
type SuccessResult = {
    success: true;
    data: any;
};

// 失败
type ErrorResult = {
    success: false;
    code: ErrorCode;
    message: string;
};
```

**示例**:
```typescript
export function handleJoinRoom(...): TJoinRoomHandlerResult {
    // 验证
    if (!roomCode) {
        return { success: false, code: 'INVALID', message: 'Missing roomCode' };
    }
    
    // 调用领域服务
    const result = roomManager.joinRoom(...);
    
    // 返回结果（不发送响应）
    return result.success 
        ? { success: true, room: result.room }
        : { success: false, code: result.error, message: '...' };
}
```

### 4. Domain Services Layer (领域服务层)

**文件**: 
- `services/room-manager.ts`
- `services/connection-manager.ts`

**职责**:
- 实现核心领域逻辑
- 管理领域实体状态
- 执行状态转换
- 数据持久化（未来）
- **独立于**传输协议（HTTP/WebSocket）

**示例**:
```typescript
class RoomManager {
    createRoom(): IRoom { /* ... */ }
    joinRoom(roomCode, user): Result { /* ... */ }
    getRoomById(id): IRoom | undefined { /* ... */ }
}
```

### 5. Models/Types Layer (模型层)

**文件**: `models/*`, `types/*`

**职责**:
- 定义数据结构
- 定义类型和接口
- 枚举定义
- **纯数据**，无逻辑

## 数据流

### HTTP 请求流

```
Request → Route → Controller → Handler → Service → Domain Model
                      ↓
Response ← Controller ← Result ← Result ← Result
```

### WebSocket 消息流

```
Message → ws.ts → WSController → Handler → Service → Domain Model
                      ↓
Broadcast ← Format ← Result ← Result ← Result
```

## 关键原则

### 1. 单一职责原则 (SRP)

每层只有一个变更理由：
- **Routes**: 只在 URL 结构变化时修改
- **Controllers**: 只在请求/响应格式变化时修改
- **Handlers**: 只在业务规则变化时修改
- **Services**: 只在领域逻辑变化时修改

### 2. 依赖倒置原则 (DIP)

高层不依赖低层，都依赖抽象：
- Controllers 依赖 Handler 接口（返回类型）
- Handlers 依赖 Service 接口
- Services 依赖 Model 接口

### 3. 关注点分离

- **传输协议**（HTTP/WebSocket）→ Controllers
- **业务规则** → Handlers
- **领域逻辑** → Services
- **数据结构** → Models

### 4. DRY (Don't Repeat Yourself)

- 共享类型定义在 `types/`
- 共享业务逻辑在 `services/`
- 共享工具函数在 `utils/`

## 测试策略

### 单元测试

每层可独立测试：

```typescript
// Handler 测试（不需要 HTTP/WebSocket）
test('handleJoinRoom returns error for invalid roomCode', () => {
    const result = handleJoinRoom(...);
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID');
});

// Service 测试（纯领域逻辑）
test('roomManager.joinRoom rejects third participant', () => {
    const result = roomManager.joinRoom(...);
    expect(result.success).toBe(false);
});
```

### 集成测试

测试层之间的集成：

```typescript
// HTTP 集成测试
test('POST /room/create returns 201', async () => {
    const response = await request(app).post('/room/create');
    expect(response.status).toBe(201);
});

// WebSocket 集成测试
test('JOIN_ROOM broadcasts to all participants', () => {
    // ...
});
```

## 扩展指南

### 添加新的 HTTP 端点

1. **定义路由** (`routes/room-routes.ts`)
   ```typescript
   router.delete('/:roomId', RoomController.deleteRoom);
   ```

2. **创建控制器方法** (`controllers/room-controller.ts`)
   ```typescript
   static deleteRoom(req, res) {
       const result = roomManager.deleteRoom(req.params.roomId);
       res.json({ success: result.success });
   }
   ```

3. **添加服务方法** (`services/room-manager.ts`)
   ```typescript
   deleteRoom(roomId: string): { success: boolean } {
       // 领域逻辑
   }
   ```

### 添加新的 WebSocket 消息类型

1. **定义消息类型** (`types/ws-messages.ts`)
   ```typescript
   export enum EWSMessageType {
       LeaveRoom = 'LEAVE_ROOM',
   }
   ```

2. **创建 Handler** (`services/handlers/leave-room-handler.ts`)
   ```typescript
   export function handleLeaveRoom(...): TLeaveRoomResult {
       // 业务逻辑
   }
   ```

3. **更新 Controller** (`controllers/ws-controller.ts`)
   ```typescript
   case EWSMessageType.LeaveRoom:
       WebSocketController.handleLeaveRoomMessage(...);
   ```

## 最佳实践

1. **Controller 不应该有业务逻辑**
   - ❌ `if (room.participants.length >= 2) return error`
   - ✅ `const result = handler(...); if (!result.success) return error`

2. **Handler 不应该发送响应**
   - ❌ `connectionManager.sendToConnection(...)`
   - ✅ `return { success: false, code: '...', message: '...' }`

3. **Service 不应该知道传输协议**
   - ❌ `roomManager.broadcastToRoom(...)`
   - ✅ `roomManager.joinRoom(...)` 返回数据

4. **类型应该在 types/ 集中定义**
   - 避免在多个文件重复定义相同类型

5. **保持文件小而专注**
   - 每个文件应该只负责一个功能
   - 超过 200 行考虑拆分

## 迁移检查清单

- [x] 创建 `controllers/room-controller.ts`
- [x] 创建 `controllers/ws-controller.ts`
- [x] 创建 `routes/room-routes.ts`
- [x] 重构 `handlers/join-room-handler.ts` (返回结果)
- [x] 重构 `handlers/chat-send-handler.ts` (返回结果)
- [x] 更新 `app.ts` (使用 routes)
- [x] 更新 `ws.ts` (使用 controller)
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 更新 README.md

## 总结

新的模块化架构带来以下好处：

1. **可测试性**: 每层可独立测试
2. **可维护性**: 职责清晰，易于定位和修改
3. **可扩展性**: 添加新功能不影响现有代码
4. **可读性**: 代码组织清晰，易于理解
5. **可重用性**: 业务逻辑可在不同传输协议中复用
