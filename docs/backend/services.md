# Backend Services

本文档描述后端服务层的组织结构和各服务职责。

## 服务架构

```
services/
├── core/                    # 核心业务服务
│   └── room/
│       ├── room.service.ts      # 房间业务编排
│       └── room-crud.service.ts # 房间 CRUD 操作
├── handlers/                # 业务逻辑处理器
│   ├── join-room-handler.ts     # 加入房间处理
│   └── chat-send-handler.ts     # 发送消息处理
└── websocket/               # WebSocket 服务
    ├── room-manager.ts          # 房间管理器
    └── connection-manager.ts    # 连接管理器
```

---

## 核心服务 (Core Services)

### RoomService

房间业务服务，负责高层业务逻辑编排。

**文件**: `backend/src/services/core/room/room.service.ts`

**职责**:

- 协调房间相关操作
- 委托具体逻辑给 RoomManager
- 预留缓存/事件扩展点

**方法**:

```typescript
class RoomService {
    // 创建房间
    createRoom(creator: IUser): IRoom;

    // 获取房间 (通过 ID)
    getRoom(roomId: string): IRoom | null;

    // 获取房间 (通过房间码)
    getRoomByCode(roomCode: string): IRoom | null;
}
```

---

### RoomCrudService

房间 CRUD 服务，负责数据访问操作。

**文件**: `backend/src/services/core/room/room-crud.service.ts`

**职责**:

- 封装数据访问逻辑
- 为未来数据库集成预留

**当前状态**: 占位实现，实际操作委托给 RoomManager

---

## 业务处理器 (Handlers)

### JoinRoomHandler

处理加入房间的业务逻辑。

**文件**: `backend/src/services/handlers/join-room-handler.ts`

**职责**:

- 验证加入前置条件
- 调用 RoomManager 添加参与者
- 返回操作结果

**处理流程**:

```
接收 JOIN_ROOM 请求
       │
       ▼
验证 roomCode 是否存在
       │
       ▼
验证房间状态是否为 WAITING
       │
       ▼
验证房间是否已满 (< 2 人)
       │
       ▼
验证用户是否已加入
       │
       ▼
添加参与者到房间
       │
       ▼
绑定 WebSocket 连接
       │
       ▼
返回结果
```

**接口**:

```typescript
interface IJoinRoomResult {
    success: boolean;
    room?: IRoom;
    error?: {
        code: EWSErrorCode;
        message: string;
    };
}

function handleJoinRoom(
    payload: IJoinRoomPayload,
    connectionId: string
): IJoinRoomResult;
```

---

### ChatSendHandler

处理发送聊天消息的业务逻辑。

**文件**: `backend/src/services/handlers/chat-send-handler.ts`

**职责**:

- 验证发送前置条件
- 创建消息实体
- 返回操作结果

**处理流程**:

```
接收 CHAT_SEND 请求
       │
       ▼
验证用户是否已加入房间
       │
       ▼
验证房间是否存在
       │
       ▼
验证房间状态是否为 READY
       │
       ▼
验证发送者是否为参与者
       │
       ▼
创建消息实体
       │
       ▼
返回结果
```

**接口**:

```typescript
interface IChatSendResult {
    success: boolean;
    message?: IMessage;
    roomId?: string;
    error?: {
        code: EWSErrorCode;
        message: string;
    };
}

function handleChatSend(
    payload: IChatSendPayload,
    connectionId: string
): IChatSendResult;
```

---

## WebSocket 服务

### RoomManager

房间管理器，单例模式，管理所有房间的生命周期。

**文件**: `backend/src/services/websocket/room-manager.ts`

**职责**:

- 房间创建/查询/删除
- 参与者管理
- 房间状态机维护
- 生成唯一 ID 和房间码

**单例获取**:

```typescript
const roomManager = RoomManager.getInstance();
```

**方法**:

```typescript
class RoomManager {
    // 获取单例实例
    static getInstance(): RoomManager;

    // 创建房间
    createRoom(hostUser: IUser): IRoom;

    // 通过 ID 获取房间
    getRoom(roomId: string): IRoom | null;

    // 通过房间码获取房间
    getRoomByCode(roomCode: string): IRoom | null;

    // 添加参与者
    addParticipant(roomId: string, user: IUser): IRoom;

    // 移除参与者
    removeParticipant(roomId: string, userId: string): void;

    // 更新房间状态
    updateStatus(roomId: string, status: ERoomStatus): void;

    // 删除房间
    deleteRoom(roomId: string): void;
}
```

**房间状态机**:

```
┌─────────────────────────────────────────────┐
│                  WAITING                     │
│              (0-1 参与者)                    │
│                                             │
│  创建房间 ─▶ [WAITING]                       │
│  第1人加入 ─▶ [WAITING] (1人)                │
│  第2人加入 ─▶ [READY]                        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                   READY                      │
│              (2 参与者)                      │
│                                             │
│  可以发送聊天消息                            │
│  有人断开 ─▶ [CLOSED]                        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                  CLOSED                      │
│                                             │
│  房间被删除                                  │
└─────────────────────────────────────────────┘
```

---

### ConnectionManager

连接管理器，单例模式，管理所有 WebSocket 连接。

**文件**: `backend/src/services/websocket/connection-manager.ts`

**职责**:

- WebSocket 连接注册/注销
- 连接与用户/房间的绑定
- 消息广播
- 断线清理

**单例获取**:

```typescript
const connectionManager = ConnectionManager.getInstance();
```

**方法**:

```typescript
class ConnectionManager {
    // 获取单例实例
    static getInstance(): ConnectionManager;

    // 注册新连接
    registerConnection(connectionId: string, ws: WebSocket): void;

    // 注销连接
    unregisterConnection(connectionId: string): void;

    // 绑定连接到用户和房间
    bindConnection(connectionId: string, userId: string, roomId: string): void;

    // 获取连接绑定信息
    getConnectionBinding(
        connectionId: string
    ): { userId: string; roomId: string } | null;

    // 发送消息给指定连接
    sendToConnection(connectionId: string, message: IWSMessage): void;

    // 广播消息给房间内所有连接
    broadcastToRoom(roomId: string, message: IWSMessage): void;

    // 处理断开连接
    handleDisconnect(connectionId: string): void;
}
```

**数据结构**:

```typescript
// 连接映射
connections: Map<string, WebSocket>; // connectionId -> WebSocket

// 绑定映射
bindings: Map<string, { userId: string; roomId: string }>; // connectionId -> binding

// 房间连接映射
roomConnections: Map<string, Set<string>>; // roomId -> Set<connectionId>
```

---

## 服务交互流程

### 创建房间流程

```
HTTP POST /room/create
         │
         ▼
   RoomController
         │
         ▼
    RoomService.createRoom()
         │
         ▼
    RoomManager.createRoom()
         │
   ┌─────┴─────┐
   │ 生成 roomId │
   │ 生成 roomCode│
   │ 创建 IRoom │
   └─────┬─────┘
         │
         ▼
    返回 IRoom
```

### 加入房间流程

```
WebSocket JOIN_ROOM
         │
         ▼
   WSController
         │
         ▼
   handleJoinRoom()
         │
   ┌─────┴─────┐
   │ 验证房间存在 │
   │ 验证房间状态 │
   │ 验证未满   │
   └─────┬─────┘
         │
         ▼
   RoomManager.addParticipant()
         │
         ▼
   ConnectionManager.bindConnection()
         │
         ▼
   ConnectionManager.broadcastToRoom()
         │
         ▼
   所有参与者收到 JOIN_ACK
```

### 发送消息流程

```
WebSocket CHAT_SEND
         │
         ▼
   WSController
         │
         ▼
   handleChatSend()
         │
   ┌─────┴─────┐
   │ 验证连接绑定 │
   │ 验证房间就绪 │
   │ 验证是参与者 │
   └─────┬─────┘
         │
         ▼
   创建 IMessage
         │
         ▼
   ConnectionManager.broadcastToRoom()
         │
         ▼
   所有参与者收到 CHAT_RECEIVE
```

---

## 错误处理

各服务统一使用错误码返回错误：

```typescript
interface IServiceError {
    code: EWSErrorCode | EHTTPErrorCode;
    message: string;
}

interface IServiceResult<T> {
    success: boolean;
    data?: T;
    error?: IServiceError;
}
```

控制器根据服务结果格式化响应：

```typescript
// 控制器处理示例
const result = handleJoinRoom(payload, connectionId);

if (result.success) {
    broadcastToRoom(roomId, formatJoinAck(result.room));
} else {
    sendError(connectionId, result.error);
}
```

---

## 最佳实践

1. **单一职责**: 每个服务/处理器只负责一个领域
2. **依赖注入**: 服务通过单例模式获取，便于测试时替换
3. **结果返回**: 处理器返回结果对象，不直接发送响应
4. **协议无关**: 业务逻辑不依赖具体传输协议
5. **状态管理**: 房间状态通过状态机严格管理
