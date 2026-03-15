# 功能文档：震天鼓抢麦游戏

## 概述

震天鼓抢麦是双人实时竞技游戏，两名玩家在限定时间内疯狂点击鼓面，点击次数多者获胜并获得优先发言权。

**协议**: WebSocket 实时通信
**游戏时长**: 10秒（可配置）

---

## 业务流程

### 状态机

```
WAITING → COUNTDOWN → RUNNING → FINISHED
   ↑          ↑          ↑         ↑
房间就绪   开始倒计时   游戏进行   游戏结束
```

### 详细流程

```
┌─────────────────────────────────────────────────────────────────┐
│                         游戏启动流程                              │
├─────────────────────────────────────────────────────────────────┤
│  房间满员(2人)                                                    │
│       ↓                                                          │
│  等待 3 秒（等待室倒计时）                                          │
│       ↓                                                          │
│  服务器发送 DRUM_READY（时间同步 + 玩家信息）                        │
│       ↓                                                          │
│  双方各自点击「开始游戏」，发送 DRUM_START_REQUEST                  │
│       ↓                                                          │
│  每有一方就绪，服务器广播 DRUM_PLAYER_READY（readyCount）           │
│       ↓                                                          │
│  双方均就绪后，服务器发送 DRUM_START（游戏开始时间戳）              │
│       ↓                                                          │
│  倒计时 3 秒 (COUNTDOWN 阶段)                                      │
│       ↓                                                          │
│  游戏开始 (RUNNING 阶段，持续 10 秒，上限 60 次点击)               │
│       ↓                                                          │
│  服务器发送 DRUM_FINISH（游戏结束）                                 │
│       ↓                                                          │
│  服务器发送 DRUM_RESULT（最终结果）                                 │
│       ↓                                                          │
│  结果展示 (RESULT 阶段，持续 5 秒后跳转聊天室)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 时间线

```
T+0s     : 房间满员，触发等待室倒计时 (3s)
T+3s     : 发送 DRUM_READY；双方看到「开始游戏」按钮
T+3s~?   : 等待双方均点击「开始游戏」（DRUM_PLAYER_READY 广播就绪数）
T+N      : 双方均就绪，发送 DRUM_START
T+N~N+3s : 游戏倒计时 (3s)
T+N+3s   : 游戏开始 (RUNNING)
T+N+13s  : 游戏结束，发送 DRUM_FINISH + DRUM_RESULT
T+N+13s~N+18s : 结果展示 (5s)，跳转聊天室
```

---

## WebSocket 消息规格

### 消息类型枚举

```typescript
enum EWSMessageType {
    DrumReady = 'DRUM_READY',               // 服务器 → 客户端：房间就绪
    DrumPlayerReady = 'DRUM_PLAYER_READY',  // 服务器 → 客户端：玩家就绪广播
    DrumStartRequest = 'DRUM_START_REQUEST',// 客户端 → 服务器：玩家请求开始
    DrumStart = 'DRUM_START',               // 服务器 → 客户端：游戏开始
    DrumTap = 'DRUM_TAP',                   // 双向：点击事件
    DrumFinish = 'DRUM_FINISH',             // 服务器 → 客户端：游戏结束
    DrumResult = 'DRUM_RESULT',             // 服务器 → 客户端：最终结果
}
```

---

### DRUM_READY（服务器 → 客户端）

**触发时机**: 房间满员后等待室倒计时结束时发送

**用途**:
- 同步服务器时间
- 传递玩家角色和昵称信息

**消息格式**:
```typescript
interface IDrumReadyMessage {
    type: 'DRUM_READY';
    data: {
        roomId: string;
        serverTimeMs: number;    // 服务器当前时间戳（毫秒）
        hostRole: EPlayerRole;   // 房主角色（始终为 Organizer）
        organizerName: string;   // 房主显示名（默认"小冤家"）
        joinerName: string;      // 加入者显示名（默认"家冤小"）
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "DRUM_READY",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "serverTimeMs": 1737849600000,
        "hostRole": "ORGANIZER",
        "organizerName": "小冤家",
        "joinerName": "家冤小"
    },
    "timestamp": 1737849600000
}
```

---

### DRUM_PLAYER_READY（服务器 → 客户端）

**触发时机**: 每有一名玩家发送 `DRUM_START_REQUEST` 时广播

**用途**: 通知双方当前就绪人数，用于更新「等待对方准备」状态文案

**消息格式**:
```typescript
interface IDrumPlayerReadyMessage {
    type: 'DRUM_PLAYER_READY';
    data: {
        roomId: string;
        readyCount: number; // 当前已就绪玩家数（1 或 2）
    };
    timestamp: number;
}
```

---

### DRUM_START_REQUEST（客户端 → 服务器）

**触发时机**: 玩家点击「开始游戏」按钮

**用途**: 告知服务器本玩家已就绪，等双方均就绪后服务器发送 DRUM_START

**消息格式**:
```typescript
interface IDrumStartRequestMessage {
    type: 'DRUM_START_REQUEST';
    data: {
        roomId: string;
        userId: string;
    };
    timestamp: number;
}
```

---

### DRUM_START（服务器 → 客户端）

**触发时机**: DRUM_READY 之后立即发送

**用途**: 通知客户端游戏开始的精确时间戳

**消息格式**:
```typescript
interface IDrumStartMessage {
    type: 'DRUM_START';
    data: {
        roomId: string;
        startAtMs: number;  // 游戏开始的绝对时间戳（倒计时结束后）
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "DRUM_START",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "startAtMs": 1737849603000
    },
    "timestamp": 1737849600000
}
```

**计算说明**:
- `startAtMs = Date.now() + COUNTDOWN_MS (3000)`
- `endAtMs = startAtMs + GAME_DURATION_MS (10000)`

---

### DRUM_TAP（双向）

**客户端 → 服务器**: 玩家发送自己的点击
**服务器 → 客户端**: 转发对手的点击（排除发送者）

**消息格式**:
```typescript
interface IDrumTapMessage {
    type: 'DRUM_TAP';
    data: {
        roomId: string;
        role: EPlayerRole;    // 点击者角色
        delta: number;        // 本批次点击次数
        clientTimeMs: number; // 客户端时间戳
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "DRUM_TAP",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "role": "ORGANIZER",
        "delta": 5,
        "clientTimeMs": 1737849605000
    },
    "timestamp": 1737849605000
}
```

**批量发送**: 客户端可以将多次点击合并为一个 delta 值发送，减少网络请求。

---

### DRUM_FINISH（服务器 → 客户端）

**触发时机**: 游戏时间结束时发送

**消息格式**:
```typescript
interface IDrumFinishMessage {
    type: 'DRUM_FINISH';
    data: {
        roomId: string;
        endAtMs: number;  // 游戏结束时间戳
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "DRUM_FINISH",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "endAtMs": 1737849613000
    },
    "timestamp": 1737849613000
}
```

---

### DRUM_RESULT（服务器 → 客户端）

**触发时机**: DRUM_FINISH 之后立即发送

**消息格式**:
```typescript
interface IDrumResultMessage {
    type: 'DRUM_RESULT';
    data: {
        roomId: string;
        organizerScore: number;  // 房主得分
        joinerScore: number;     // 加入者得分
        winnerRole: EPlayerRole; // 获胜者角色
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "DRUM_RESULT",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "organizerScore": 85,
        "joinerScore": 72,
        "winnerRole": "ORGANIZER"
    },
    "timestamp": 1737849613100
}
```

---

## 数据模型

### 玩家角色

```typescript
enum EPlayerRole {
    Organizer = 'ORGANIZER',  // 房主（第一个加入的玩家）
    Joiner = 'JOINER',        // 加入者（第二个加入的玩家）
}
```

### 游戏阶段

```typescript
enum EGamePhase {
    Waiting = 'WAITING',     // 等待开始
    Countdown = 'COUNTDOWN', // 倒计时中
    Running = 'RUNNING',     // 游戏进行中
    Finished = 'FINISHED',   // 游戏已结束
}
```

### 游戏状态

```typescript
interface IDrumGameState {
    roomId: string;
    phase: EGamePhase;
    hostRole: EPlayerRole;      // 始终为 ORGANIZER
    organizer: IUser;           // 房主用户信息
    joiner: IUser;              // 加入者用户信息
    organizerScore: number;     // 房主当前得分
    joinerScore: number;        // 加入者当前得分
    startAtMs: number;          // 游戏开始时间
    endAtMs: number;            // 游戏结束时间
}
```

### 游戏结果

```typescript
interface IDrumGameResult {
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;
}
```

---

## 游戏规则

### 胜负判定

| 场景 | 获胜者 |
|------|--------|
| 房主得分 > 加入者得分 | 房主（Organizer） |
| 加入者得分 > 房主得分 | 加入者（Joiner） |
| 得分相同（平局） | 房主（Organizer）优先 |

### 角色分配规则

- ✅ 房主（创建房间者）始终为 `ORGANIZER`
- ✅ 加入者始终为 `JOINER`
- ✅ 角色在游戏初始化时确定，不可变更

### 昵称显示规则

- ✅ 如果用户设置了昵称，显示用户昵称
- ✅ 如果用户昵称为 "匿名用户"，房主显示 "小冤家"
- ✅ 如果用户昵称为 "匿名用户"，加入者显示 "家冤小"

---

## 配置项

```typescript
// backend/src/constants/config.ts

export const WAITING_ROOM_CONFIG = {
    /** 等待室到游戏的倒计时 (ms) */
    COUNTDOWN_MS: 3000,
} as const;

export const DRUM_CONFIG = {
    /** 游戏开始前倒计时 (ms) */
    COUNTDOWN_MS: 3000,
    /** 游戏持续时间 (ms) */
    GAME_DURATION_MS: 10000,
} as const;
```

### 时间配置说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| WAITING_ROOM_CONFIG.COUNTDOWN_MS | 3000ms | 房间满员后到游戏开始的等待时间 |
| DRUM_CONFIG.COUNTDOWN_MS | 3000ms | 游戏开始前的倒计时 |
| DRUM_CONFIG.GAME_DURATION_MS | 10000ms | 游戏进行时间 |
| RESULT_DISPLAY_MS（前端）| 5000ms | 结果展示时长，之后跳转聊天室 |
| MAX_TAPS（前端）| 60 | 单局最大有效点击次数上限 |

---

## 错误处理

### DRUM_TAP 错误

| 错误码 | 场景 | 说明 |
|--------|------|------|
| `INVALID_PAYLOAD` | 消息格式错误 | 检查 roomId、role、delta 字段 |
| `ROOM_NOT_FOUND` | 游戏不存在 | 房间可能已关闭 |
| `ROOM_NOT_READY` | 游戏未在进行中 | 只有 RUNNING 阶段才接受点击 |

### 错误响应格式

```json
{
    "type": "ERROR",
    "data": {
        "code": "ROOM_NOT_READY",
        "message": "Game is not running"
    },
    "timestamp": 1737849605000
}
```

---

## 后端实现

### 代码路径

```
backend/src/
├── constants/
│   └── config.ts                    # 游戏配置常量
├── types/websocket/
│   ├── base.ts                      # 基础类型定义
│   └── drum.ts                      # Drum 消息类型定义
├── models/schemas/
│   └── drum-message.schema.ts       # Zod 验证 Schema
├── controllers/
│   └── ws-controller.ts             # WebSocket 路由控制
├── services/
│   ├── handlers/
│   │   └── drum-tap-handler.ts      # DRUM_TAP 业务处理
│   └── websocket/
│       └── drum-game-manager.ts     # 游戏状态管理（单例）
```

### 架构分层

```
┌─────────────────────────────────────────────┐
│             ws-controller.ts                │  ← 路由层：消息分发、响应格式化
├─────────────────────────────────────────────┤
│           drum-tap-handler.ts               │  ← 业务层：验证、业务逻辑
├─────────────────────────────────────────────┤
│          drum-game-manager.ts               │  ← 领域层：状态管理、计分
└─────────────────────────────────────────────┘
```

### 核心代码

#### 1. 游戏初始化 (ws-controller.ts)

```typescript
private static startDrumGame(roomId: string): void {
    const room = roomManager.getRoomById(roomId);
    if (!room) return;

    // 初始化游戏状态
    const game = drumGameManager.initGame(room);

    // 发送 DRUM_READY
    connectionManager.broadcastToRoom(roomId, {
        type: EWSMessageType.DrumReady,
        data: {
            roomId,
            serverTimeMs: Date.now(),
            hostRole: game.hostRole,
            organizerName,
            joinerName,
        },
        timestamp: Date.now(),
    });

    // 计算时间节点
    const startAtMs = Date.now() + DRUM_CONFIG.COUNTDOWN_MS;
    const endAtMs = startAtMs + DRUM_CONFIG.GAME_DURATION_MS;
    drumGameManager.setTiming(roomId, startAtMs, endAtMs);

    // 发送 DRUM_START
    connectionManager.broadcastToRoom(roomId, {
        type: EWSMessageType.DrumStart,
        data: { roomId, startAtMs },
        timestamp: Date.now(),
    });

    // 调度阶段转换
    setTimeout(() => {
        drumGameManager.setPhase(roomId, EGamePhase.Running);
    }, DRUM_CONFIG.COUNTDOWN_MS);

    setTimeout(() => {
        WebSocketController.finishDrumGame(roomId, endAtMs);
    }, DRUM_CONFIG.COUNTDOWN_MS + DRUM_CONFIG.GAME_DURATION_MS);
}
```

#### 2. 点击处理 (drum-tap-handler.ts)

```typescript
export function handleDrumTap(message: IDrumTapMessage): TDrumTapHandlerResult {
    // 验证消息格式
    const validation = DrumTapDataSchema.safeParse(message.data);
    if (!validation.success) {
        return { success: false, code: EWSErrorCode.InvalidPayload, message: '...' };
    }

    const { roomId, role, delta } = validation.data;

    // 检查游戏存在
    const game = drumGameManager.getGame(roomId);
    if (!game) {
        return { success: false, code: EWSErrorCode.RoomNotFound, message: '...' };
    }

    // 检查游戏状态
    if (game.phase !== EGamePhase.Running) {
        return { success: false, code: EWSErrorCode.RoomNotReady, message: '...' };
    }

    // 记录点击
    drumGameManager.recordTap(roomId, role, delta);

    return { success: true, roomId, role, delta };
}
```

#### 3. 计分逻辑 (drum-game-manager.ts)

```typescript
recordTap(roomId: string, role: EPlayerRole, delta: number): IDrumGameState | undefined {
    const game = this.games.get(roomId);
    if (!game || game.phase !== EGamePhase.Running) return game;

    if (role === EPlayerRole.Organizer) {
        game.organizerScore += delta;
    } else {
        game.joinerScore += delta;
    }

    return game;
}

calculateResult(roomId: string): IDrumGameResult | undefined {
    const game = this.games.get(roomId);
    if (!game) return undefined;

    let winnerRole: EPlayerRole;
    if (game.organizerScore > game.joinerScore) {
        winnerRole = EPlayerRole.Organizer;
    } else if (game.joinerScore > game.organizerScore) {
        winnerRole = EPlayerRole.Joiner;
    } else {
        // 平局：房主获胜
        winnerRole = EPlayerRole.Organizer;
    }

    game.phase = EGamePhase.Finished;

    return {
        organizerScore: game.organizerScore,
        joinerScore: game.joinerScore,
        winnerRole,
    };
}
```

---

## 消息序列图

```
┌────────┐          ┌────────┐          ┌────────┐
│ Client │          │ Server │          │ Client │
│  (房主) │          │        │          │ (加入者)│
└───┬────┘          └───┬────┘          └───┬────┘
    │                   │                   │
    │   房间满员触发     │                   │
    │                   │                   │
    │<──DRUM_READY──────│───DRUM_READY─────>│
    │   (时间同步)       │                   │
    │                   │                   │
    │───START_REQUEST──>│                   │
    │                   │───PLAYER_READY───>│ (readyCount=1)
    │<──PLAYER_READY────│                   │
    │                   │<──START_REQUEST───│
    │<──PLAYER_READY────│───PLAYER_READY───>│ (readyCount=2)
    │                   │                   │
    │<──DRUM_START──────│───DRUM_START─────>│
    │   (开始时间戳)     │                   │
    │                   │                   │
    │     [3秒倒计时]    │                   │
    │                   │                   │
    │───DRUM_TAP───────>│                   │
    │   (点击x5)        │───DRUM_TAP───────>│
    │                   │   (转发给对手)     │
    │                   │                   │
    │                   │<──DRUM_TAP────────│
    │<──DRUM_TAP────────│   (点击x3)        │
    │   (转发给对手)     │                   │
    │                   │                   │
    │     [10秒游戏]     │                   │
    │                   │                   │
    │<──DRUM_FINISH─────│───DRUM_FINISH────>│
    │   (游戏结束)       │                   │
    │                   │                   │
    │<──DRUM_RESULT─────│───DRUM_RESULT────>│
    │   (最终结果)       │                   │
    │                   │                   │
    │   [5秒结果展示]   │                   │
    │   → 跳转聊天室     │                   │
    │                   │                   │
```

---

## 测试用例

### WebSocket 测试

```bash
# 连接 WebSocket
wscat -c ws://localhost:8080/ws

# 发送点击消息
{"type":"DRUM_TAP","data":{"roomId":"test-room","role":"ORGANIZER","delta":5,"clientTimeMs":1737849605000}}
```

### 单元测试场景

| 测试场景 | 预期结果 |
|----------|----------|
| 游戏初始化 | 状态为 WAITING，双方得分为 0 |
| 倒计时阶段点击 | 忽略点击，返回 ROOM_NOT_READY |
| 游戏中点击 | 正确累加得分，转发给对手 |
| 房主得分高 | 房主获胜 |
| 加入者得分高 | 加入者获胜 |
| 平局 | 房主获胜（优先规则） |
| 游戏结束后点击 | 忽略点击 |

---

## 性能指标

- **消息延迟**: < 50ms (P95)
- **点击处理吞吐**: > 1000 taps/s per room
- **内存占用**: 每个游戏状态约 500 bytes

---

## 常见问题

### Q1: 为什么需要时间同步？

客户端倒计时需要与服务器保持一致，`DRUM_READY` 中的 `serverTimeMs` 用于计算时间偏移。

### Q2: 点击消息可以批量发送吗？

可以，`delta` 字段支持批量累计，建议每 100ms 发送一次以减少网络开销。

### Q3: 平局时为什么房主获胜？

产品设计规则，鼓励用户创建房间。

### Q4: 游戏结束后房间状态如何？

游戏状态会被清理，但房间仍然存在，可用于后续聊天功能。

---

## 下一步

游戏结束后，推荐阅读：
- [聊天消息](03-chat-messaging.md) - 游戏后的聊天功能
- [连接管理](04-connection-lifecycle.md) - WebSocket 连接生命周期
- [错误处理](05-error-handling.md) - 完整错误码参考

---

**相关文档**:
- [加入房间](02-join-room.md)
- [数据模型](../data-models.md)
- [API 规格](../api-specification.md)
