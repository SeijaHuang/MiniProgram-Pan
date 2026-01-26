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
│   ├── chat-send-handler.ts     # 发送消息处理
│   └── drum-tap-handler.ts      # 鼓点击处理
└── websocket/               # WebSocket 服务
    ├── room-manager.ts          # 房间管理器
    ├── connection-manager.ts    # 连接管理器
    └── drum-game-manager.ts     # 鼓游戏管理器
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

### DrumTapHandler

处理鼓点击的业务逻辑。

**文件**: `backend/src/services/handlers/drum-tap-handler.ts`

**职责**:

- 验证点击请求
- 检查游戏状态
- 记录分数
- 返回操作结果

**处理流程**:

```
接收 DRUM_TAP 请求
       │
       ▼
验证 payload 格式 (roomId, role, delta)
       │
       ▼
检查游戏是否存在
       │
       ▼
检查游戏是否处于 RUNNING 状态
       │
       ▼
调用 DrumGameManager.recordTap()
       │
       ▼
累加对应玩家分数
       │
       ▼
返回结果
```

**接口**:

```typescript
interface IDrumTapResult {
    success: true;
    roomId: string;
    role: EPlayerRole;
    delta: number;
}

interface IDrumTapError {
    success: false;
    code: EWSErrorCode;
    message: string;
}

type TDrumTapHandlerResult = IDrumTapResult | IDrumTapError;

function handleDrumTap(message: IDrumTapMessage): TDrumTapHandlerResult;
```

**验证逻辑**:

- 使用 Zod Schema 验证 payload 格式
- 游戏不存在返回 `RoomNotFound`
- 游戏未运行返回 `RoomNotReady`
- 只有 `RUNNING` 阶段的点击会被记录

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

### DrumGameManager

鼓游戏管理器，单例模式，管理所有鼓游戏的状态。

**文件**: `backend/src/services/websocket/drum-game-manager.ts`

**职责**:

- 游戏初始化与角色分配
- 游戏状态机管理
- 分数累计与记录
- 胜负判定
- 游戏清理

**单例获取**:

```typescript
const drumGameManager = DrumGameManager.getInstance();
```

**方法**:

```typescript
class DrumGameManager {
    // 获取单例实例
    static getInstance(): DrumGameManager;

    // 初始化游戏
    initGame(room: IRoom): IDrumGameState;

    // 获取游戏状态
    getGame(roomId: string): IDrumGameState | undefined;

    // 设置游戏阶段
    setPhase(roomId: string, phase: EGamePhase): IDrumGameState | undefined;

    // 设置游戏计时
    setTiming(
        roomId: string,
        startAtMs: number,
        endAtMs: number
    ): IDrumGameState | undefined;

    // 记录点击并累加分数
    recordTap(
        roomId: string,
        role: EPlayerRole,
        delta: number
    ): IDrumGameState | undefined;

    // 计算游戏结果
    calculateResult(roomId: string): IDrumGameResult | undefined;

    // 清理游戏
    cleanupGame(roomId: string): void;

    // 获取所有游戏（调试用）
    getAllGames(): IDrumGameState[];
}
```

**游戏状态**:

```typescript
interface IDrumGameState {
    roomId: string;
    phase: EGamePhase; // WAITING, COUNTDOWN, RUNNING, FINISHED
    hostRole: EPlayerRole; // 房主角色（总是 Organizer）
    organizer: IUser; // 组织者（房主）
    joiner: IUser; // 加入者
    organizerScore: number; // 组织者分数
    joinerScore: number; // 加入者分数
    startAtMs: number; // 游戏开始时间戳
    endAtMs: number; // 游戏结束时间戳
}
```

**游戏结果**:

```typescript
interface IDrumGameResult {
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;
}
```

**游戏状态机**:

```
┌─────────────────────────────────────────────┐
│                  WAITING                     │
│             (等待开始)                        │
│                                             │
│  游戏初始化时的默认状态                        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                 COUNTDOWN                    │
│             (倒计时阶段)                      │
│                                             │
│  准备开始，3秒倒计时                          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                  RUNNING                     │
│             (游戏进行中)                      │
│                                             │
│  玩家可以点击鼓，累计分数                      │
│  持续 5 秒                                   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│                 FINISHED                     │
│             (游戏结束)                        │
│                                             │
│  计算胜负，分数高者获胜                        │
│  平局时房主（Organizer）获胜                  │
└─────────────────────────────────────────────┘
```

**角色分配规则**:

- **房主（Host）**: 永远是 `Organizer` 角色
- **加入者（Joiner）**: 永远是 `Joiner` 角色
- 角色在游戏初始化时确定，不会改变

**胜负判定**:

1. 分数高者获胜
2. 分数相等时，房主（Organizer）获胜
3. 游戏结束时自动设置阶段为 `FINISHED`

**关键逻辑**:

- **点击记录**: 只有 `RUNNING` 阶段的点击才会被记录
- **分数累加**: 每次点击传入 `delta`，累加到对应玩家的分数
- **游戏清理**: 游戏结束后应调用 `cleanupGame()` 释放内存

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

### 鼓游戏流程

```
房间 READY 状态
         │
         ▼
   DrumGameManager.initGame()
         │
   ┌─────┴─────┐
   │ 确定角色分配 │
   │ Host → Organizer │
   │ Joiner → Joiner │
   │ phase = WAITING │
   └─────┬─────┘
         │
         ▼
   广播 DRUM_START
         │
         ▼
   phase = COUNTDOWN (3秒)
         │
         ▼
   广播 DRUM_COUNTDOWN
         │
         ▼
   phase = RUNNING (5秒)
         │
   ┌─────┴─────┐
   │ 玩家点击鼓 │
   │ WebSocket DRUM_TAP │
   └─────┬─────┘
         │
         ▼
   handleDrumTap()
         │
   ┌─────┴─────┐
   │ 验证请求格式 │
   │ 检查游戏存在 │
   │ 检查是否 RUNNING │
   └─────┬─────┘
         │
         ▼
   DrumGameManager.recordTap()
         │
   ┌─────┴─────┐
   │ 累加分数   │
   │ Organizer: +delta │
   │ Joiner: +delta │
   └─────┬─────┘
         │
         ▼
   广播 DRUM_TAP_ACK
         │
         ▼
   [5秒后] 游戏结束
         │
         ▼
   DrumGameManager.calculateResult()
         │
   ┌─────┴─────┐
   │ 比较分数   │
   │ 确定胜者   │
   │ phase = FINISHED │
   └─────┬─────┘
         │
         ▼
   广播 DRUM_RESULT
         │
         ▼
   DrumGameManager.cleanupGame()
```

**WebSocket 消息类型**:

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `DRUM_READY` | Server → Client | 房间就绪，同步服务器时间和角色信息 |
| `DRUM_START` | Server → Client | 游戏开始信号（含倒计时结束时间戳） |
| `DRUM_TAP` | Bidirectional | 玩家点击事件（客户端发送自己的点击，服务端广播对手的点击） |
| `DRUM_FINISH` | Server → Client | 游戏结束信号 |
| `DRUM_RESULT` | Server → Client | 最终结果（含分数和胜者） |

**消息数据结构**:

```typescript
// DRUM_READY
interface IDrumReadyData {
    roomId: string;
    serverTimeMs: number; // 服务器时间戳（用于客户端时间同步）
    hostRole: EPlayerRole; // 房主角色（永远是 Organizer）
    organizerName: string;
    joinerName: string;
}

// DRUM_START
interface IDrumStartData {
    roomId: string;
    startAtMs: number; // 游戏开始的绝对时间戳（倒计时结束后）
}

// DRUM_TAP
interface IDrumTapData {
    roomId: string;
    role: EPlayerRole; // 点击者角色
    delta: number; // 本次批量点击数量
    clientTimeMs: number; // 客户端时间戳
}

// DRUM_FINISH
interface IDrumFinishData {
    roomId: string;
    endAtMs: number; // 游戏结束时间戳
}

// DRUM_RESULT
interface IDrumResultData {
    roomId: string;
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;
}
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
