# 数据模型文档

## 概述

后端系统的核心数据模型定义，包括实体、枚举和接口规范。

---

## 核心实体

### Room（房间）

双人聊天室的核心实体。

#### 定义

```typescript
interface IRoom {
  roomId: string;              // 唯一房间ID（UUID）
  roomCode: string;            // 6位邀请代码
  hostUserId: string;          // 房主用户ID
  participants: IParticipant[]; // 参与者列表（最多2人）
  status: ERoomStatus;         // 房间状态
  createdAt: number;           // 创建时间戳（毫秒）
}
```

#### 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `roomId` | string | 服务器生成的唯一标识（UUID） | `"f47ac10b-58cc-4372-a567-0e02b2c3d479"` |
| `roomCode` | string | 6位邀请代码（大写字母+数字） | `"A1B2C3"` |
| `hostUserId` | string | 创建房间的用户ID | `"user-12345"` |
| `participants` | IParticipant[] | 参与者列表 | `[{user, joinedAt}, ...]` |
| `status` | ERoomStatus | 房间当前状态 | `"WAITING"`, `"READY"`, `"CLOSED"` |
| `createdAt` | number | Unix 时间戳（毫秒） | `1737849600000` |

#### 业务约束

- ✅ `roomId` 全局唯一（UUID v4）
- ✅ `roomCode` 全局唯一（36^6 约21亿组合）
- ✅ `participants` 最多2个元素
- ✅ `status` 状态转换规则：
  - 创建时：`WAITING`
  - 第2人加入：`WAITING` → `READY`
  - 连接断开/主动关闭：任意状态 → `CLOSED`

#### 示例

```json
{
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
```

---

### ERoomStatus（房间状态）

房间生命周期的状态枚举。

#### 定义

```typescript
enum ERoomStatus {
  Waiting = "WAITING",   // 等待第二个用户加入
  Ready = "READY",       // 双方就位，可以聊天
  Closed = "CLOSED"      // 房间已关闭
}
```

#### 状态转换图

```
[创建]
   ↓
WAITING (0-1人)
   ↓ (第2人加入)
READY (2人)
   ↓ (断开/关闭)
CLOSED
```

#### 转换规则

| 当前状态 | 事件 | 新状态 |
|---------|------|--------|
| - | 创建房间 | `WAITING` |
| `WAITING` | 第1人加入 | `WAITING` |
| `WAITING` | 第2人加入 | `READY` |
| `READY` | 任一人断开 | `WAITING` 或 `CLOSED` |
| `WAITING` | 唯一用户断开 | `CLOSED` |
| 任意状态 | 主动关闭 | `CLOSED` |

---

### IParticipant（参与者）

房间参与者的信息。

#### 定义

```typescript
interface IParticipant {
  user: IUser;       // 用户信息
  joinedAt: number;  // 加入时间戳（毫秒）
}
```

#### 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `user` | IUser | 用户完整信息 | `{userId, nickname}` |
| `joinedAt` | number | Unix 时间戳（服务器时间） | `1737849600000` |

#### 示例

```json
{
  "user": {
    "userId": "user-12345",
    "nickname": "Alice"
  },
  "joinedAt": 1737849600000
}
```

---

### User（用户）

用户的基本信息（会话级别，无持久化）。

#### 定义

```typescript
interface IUser {
  userId: string;    // 用户唯一标识
  nickname: string;  // 用户昵称
}
```

#### 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `userId` | string | 客户端生成的唯一标识 | `"user-12345"` |
| `nickname` | string | 用户显示名称 | `"Alice"` |

#### 特点

- ✅ 会话级别（不涉及账户系统）
- ✅ `userId` 由客户端生成和管理
- ✅ 服务器仅验证格式，不管理用户账户
- ❌ 无需注册/登录
- ❌ 不持久化

#### 示例

```json
{
  "userId": "user-12345",
  "nickname": "Alice"
}
```

---

### Message（消息）

聊天消息实体。

#### 定义

```typescript
interface IMessage {
  messageId: string;        // 消息唯一ID（UUID）
  roomId: string;           // 所属房间ID
  sender: IUser;            // 发送者信息
  type: EMessageType;       // 消息类型
  content: IMessageContent; // 消息内容
  createdAt: number;        // 创建时间戳（毫秒）
}
```

#### 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `messageId` | string | 服务器生成的唯一标识 | `"msg-abc123"` |
| `roomId` | string | 所属房间的 ID | `"room-xyz"` |
| `sender` | IUser | 发送者完整信息 | `{userId, nickname}` |
| `type` | EMessageType | 消息类型枚举 | `"TEXT"` |
| `content` | IMessageContent | 根据 type 不同而不同 | `{type: "TEXT", text: "..."}` |
| `createdAt` | number | 服务器生成的时间戳 | `1737849800000` |

#### 业务约束

- ✅ `messageId` 全局唯一（UUID v4）
- ✅ `roomId` 必须存在
- ✅ `sender` 必须是房间参与者
- ✅ `createdAt` 使用服务器时间（权威）
- ❌ 当前版本不持久化（仅实时转发）

#### 示例

```json
{
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
```

---

### EMessageType（消息类型）

消息类型枚举。

#### 定义

```typescript
enum EMessageType {
  Text = "TEXT"
  // 未来扩展：Image, Audio, Emoji 等
}
```

#### 当前支持

| 类型 | 描述 | 状态 |
|------|------|------|
| `TEXT` | 文本消息 | ✅ 已实现 |

---

### IMessageContent（消息内容）

消息内容的联合类型。

#### 定义

```typescript
type IMessageContent = {
  type: EMessageType.Text;
  text: string;
};
// 未来扩展其他类型
```

#### 字段说明（TEXT 类型）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| `type` | `"TEXT"` | 类型标识 | 固定值 |
| `text` | string | 文本内容 | 不能为空 |

#### 示例

```json
{
  "type": "TEXT",
  "text": "Hello, world!"
}
```

---

### IConnectionData（连接数据）

WebSocket 连接的运行时数据（非领域模型）。

#### 定义

```typescript
interface IConnectionData {
  connectionId: string;   // 连接唯一标识（UUID）
  socket: WebSocket;      // 原生 WebSocket 对象
  userId?: string;        // 用户ID（加入房间后绑定）
  roomId?: string;        // 房间ID（加入房间后绑定）
}
```

#### 字段说明

| 字段 | 类型 | 说明 | 何时设置 |
|------|------|------|---------|
| `connectionId` | string | 连接建立时生成 | `onConnection` |
| `socket` | WebSocket | 原生 socket 对象 | `onConnection` |
| `userId` | string? | 用户ID | `JOIN_ROOM` 成功后 |
| `roomId` | string? | 房间ID | `JOIN_ROOM` 成功后 |

#### 生命周期

```
1. 连接建立 → connectionId, socket
2. JOIN_ROOM → 绑定 userId, roomId
3. 连接断开 → 清理所有数据
```

#### 用途

- 消息路由（根据 connectionId 查找 socket）
- 用户查找（根据 userId 查找 connectionId）
- 房间广播（根据 roomId 查找所有 connectionIds）

---

### ASR 文本同步状态（内部管理）

**架构说明**: 在客户端直连架构中，后端不管理 ASR 会话实体，只管理文本同步状态。客户端直接连接腾讯云 ASR 进行语音识别，后端负责同步和广播识别结果。

#### IASRSessionState（内部状态）

后端内部维护的会话状态，用于去重和节流：

```typescript
interface IASRSessionState {
  lastSeq: number;                      // 最后处理的序列号
  finalReceived: boolean;               // 是否已收到 Final
  pendingPartial: IASRTextPushMessage;  // 待发送的 Partial
  throttleTimer: NodeJS.Timeout | null; // 节流定时器
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `lastSeq` | number | 最后处理的序列号，用于去重 |
| `finalReceived` | boolean | 是否已收到 Final 消息 |
| `pendingPartial` | IASRTextPushMessage? | 待节流发送的 Partial 消息 |
| `throttleTimer` | NodeJS.Timeout? | 节流定时器（200ms） |

#### 会话管理机制

- **创建**: 收到第一个 `ASR_TEXT_PUSH` 时自动创建
- **去重**: `seq <= lastSeq` 的消息被丢弃
- **节流**: Partial 消息节流到 200ms 间隔
- **重置**: Final 后 100ms 自动重置（准备下一次录音）
- **清理**: 用户断开连接时清理所有会话

#### 生命周期

```
1. 收到 ASR_TEXT_PUSH (seq: 0) → 创建会话
2. 收到 ASR_TEXT_PUSH (seq: 1, 2, ...) → 更新 lastSeq
3. 收到 ASR_TEXT_PUSH (isFinal: true) → 标记 finalReceived
4. 100ms 后 → 重置会话（为下次录音准备）
```

---

### ASR 文本类型

ASR 识别文本分为两种类型，通过 `isFinal` 字段区分。

#### 类型说明

| 类型 | isFinal | 描述 | 用途 | 覆盖规则 |
|------|---------|------|------|---------|
| **Partial** | `false` | 实时转写中间结果 | 实时展示，不断更新 | 新的覆盖旧的 |
| **Final** | `true` | 已确认文本 | 固化展示，用于分析 | 不可覆盖 |

#### 在消息中的体现

```typescript
// Partial 示例（客户端 → 服务器）
{
  "type": "ASR_TEXT_PUSH",
  "data": {
    "roomId": "room-123456",
    "speakerId": "user-alice",
    "seq": 5,
    "text": "我觉得你刚才…",
    "isFinal": false  // ← Partial
  },
  "timestamp": 1737849600000
}

// Final 示例（客户端 → 服务器）
{
  "type": "ASR_TEXT_PUSH",
  "data": {
    "roomId": "room-123456",
    "speakerId": "user-alice",
    "seq": 10,
    "text": "我觉得你刚才说的不对",
    "isFinal": true   // ← Final
  },
  "timestamp": 1737849601000
}

// 服务器广播（服务器 → 客户端）
{
  "type": "ASR_TEXT",
  "data": {
    "roomId": "room-123456",
    "speakerId": "user-alice",
    "seq": 10,
    "text": "我觉得你刚才说的不对",
    "isFinal": true
  },
  "timestamp": 1737849601100
}
```

---

### 震天鼓游戏状态

震天鼓是双人实时竞技小游戏，通过 `DrumGameManager` 单例管理游戏状态。

#### EGamePhase（游戏阶段）

```typescript
enum EGamePhase {
  Waiting = 'WAITING',       // 等待游戏初始化
  Countdown = 'COUNTDOWN',   // 3秒倒计时中
  Running = 'RUNNING',       // 游戏进行中（10秒）
  Finished = 'FINISHED'      // 游戏结束
}
```

#### EPlayerRole（玩家角色）

```typescript
enum EPlayerRole {
  Organizer = 'Organizer',   // 房主（创建者）
  Joiner = 'Joiner'          // 加入者
}
```

#### IDrumGameState（游戏状态）

```typescript
interface IDrumGameState {
  roomId: string;
  phase: EGamePhase;
  organizerScore: number;     // 房主总点击数
  joinerScore: number;        // 加入者总点击数
  startAtMs?: number;         // 游戏开始时间戳
  endAtMs?: number;           // 游戏结束时间戳
}
```

#### IDrumGameResult（游戏结果）

```typescript
interface IDrumGameResult {
  roomId: string;
  organizerScore: number;
  joinerScore: number;
  winnerRole: EPlayerRole;    // 获胜者角色（平局时房主胜）
}
```

#### 游戏状态流转

```
initGame(room) → WAITING
   ↓ setPhase(COUNTDOWN)
COUNTDOWN
   ↓ setPhase(RUNNING) + setTiming(startAtMs, endAtMs)
RUNNING → recordTap(roomId, role, delta) 记录点击
   ↓ setPhase(FINISHED)
FINISHED → calculateResult(roomId) 计算结果
   ↓
cleanupGame(roomId) 清理状态
```

---

### 表情消息类型

#### IEmojiSendMessage（发送表情）

```typescript
interface IEmojiSendMessage {
  type: "EMOJI_SEND";
  data: {
    roomId: string;       // 房间ID
    senderId: string;     // 发送者 userId
    emoji: string;        // 表情内容
  };
  timestamp: number;
}
```

#### IEmojiReceiveMessage（接收表情）

```typescript
interface IEmojiReceiveMessage {
  type: "EMOJI_RECEIVE";
  data: {
    roomId: string;
    senderId: string;
    emoji: string;
  };
  timestamp: number;
}
```

**关键行为**:
- 仅转发给对方（`broadcastToRoomExcept`）
- 发送者必须是房间参与者

---

### 震天鼓 WebSocket 消息类型

#### IDrumReadyMessage

游戏准备消息（Server → All），房间满员后 3 秒发送。

```typescript
interface IDrumReadyMessage {
  type: "DRUM_READY";
  data: {
    roomId: string;
    serverTimeMs: number;        // 服务器当前时间（同步基准）
    hostRole: EPlayerRole;       // 房主角色
    organizerName: string;       // 房主昵称（或默认 '小冤家'）
    joinerName: string;          // 加入者昵称（或默认 '家冤小'）
  };
  timestamp: number;
}
```

#### IDrumStartMessage

游戏开始消息（Server → All），DRUM_READY 同时发送。

```typescript
interface IDrumStartMessage {
  type: "DRUM_START";
  data: {
    roomId: string;
    startAtMs: number;           // 游戏开始绝对时间戳
  };
  timestamp: number;
}
```

#### IDrumTapMessage

点击消息（Bidirectional）。

```typescript
// Client → Server
interface IDrumTapMessage {
  type: "DRUM_TAP";
  data: {
    roomId: string;
    role: EPlayerRole;
    delta: number;               // 本次批量点击数
    clientTimeMs: number;        // 客户端时间戳
  };
  timestamp: number;
}

// Server → Opponent Only（转发给对方）
// 格式相同
```

#### IDrumFinishMessage

游戏结束消息（Server → All），游戏时间到时发送。

```typescript
interface IDrumFinishMessage {
  type: "DRUM_FINISH";
  data: {
    roomId: string;
    endAtMs: number;             // 游戏结束绝对时间戳
  };
  timestamp: number;
}
```

#### IDrumResultMessage

游戏结果消息（Server → All），DRUM_FINISH 后立即发送。

```typescript
interface IDrumResultMessage {
  type: "DRUM_RESULT";
  data: {
    roomId: string;
    organizerScore: number;
    joinerScore: number;
    winnerRole: EPlayerRole;     // 'Organizer' | 'Joiner'
  };
  timestamp: number;
}
```

---

### LLM 判决相关类型

#### IJudgmentResponse（判决结果）

LLM 生成的 AI 判决结果。

```typescript
interface IJudgmentResponse {
  caseNumber: string;              // 案件编号，如 "NO.12345"
  responsibility: {
    player1: number;               // 0-100
    player2: number;               // 0-100
    thirdParty: {
      factors: IThirdPartyFactor[];
    };
  };
  radarChart: {
    player1: IRadarScores;
    player2: IRadarScores;
  };
  verdict: string;                 // 大老爷赠言（50-100 字符）
}
```

#### IRadarScores（雷达图六维评分）

```typescript
interface IRadarScores {
  嘴硬程度: number;    // 0-100
  翻旧账: number;      // 0-100
  逻辑滑坡: number;    // 0-100
  撒娇暴击: number;    // 0-100
  求生欲: number;      // 0-100
  受害者演技: number;  // 0-100
}
```

#### IThirdPartyFactor（第三方因素）

```typescript
interface IThirdPartyFactor {
  name: string;        // 搞笑因素名称，如 "水星逆行"
  percentage: number;  // 百分比
}
```

#### ICreateJudgmentRequest（判决请求）

```typescript
interface ICreateJudgmentRequest {
  player1Speech: string;           // 1-8000 字符
  player2Speech: string;           // 1-8000 字符
  idempotencyKey?: string;         // 可选，最长 128 字符
}
```

---

## 数据传输对象（DTO）

### CreateRoomRequest

创建房间的请求体。

```typescript
interface ICreateRoomRequest {
  creator: IUser;
}
```

**示例**:
```json
{
  "creator": {
    "userId": "user-12345",
    "nickname": "Alice"
  }
}
```

---

### CreateRoomResponse

创建房间的响应体。

```typescript
interface ICreateRoomResponse {
  success: true;
  data: {
    room: IRoom;
  }
}
```

**示例**:
```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "...",
      "roomCode": "A1B2C3",
      "hostUserId": "user-12345",
      "participants": [],
      "status": "WAITING",
      "createdAt": 1737849600000
    }
  }
}
```

---

## WebSocket 消息类型

### IJoinRoomMessage

加入房间消息（客户端 → 服务器）。

```typescript
interface IJoinRoomMessage {
  type: "JOIN_ROOM";
  data: {
    roomCode: string;
    user: IUser;
  };
  timestamp: number;
}
```

---

### IJoinAckMessage

加入确认消息（服务器 → 客户端）。

```typescript
interface IJoinAckMessage {
  type: "JOIN_ACK";
  data: {
    room: IRoom;
  };
  timestamp: number;
}
```

---

### IChatSendMessage

发送聊天消息（客户端 → 服务器）。

```typescript
interface IChatSendMessage {
  type: "CHAT_SEND";
  data: {
    content: IMessageContent;
  };
  timestamp: number;
}
```

---

### IChatReceiveMessage

接收聊天消息（服务器 → 客户端）。

```typescript
interface IChatReceiveMessage {
  type: "CHAT_RECEIVE";
  data: {
    message: IMessage;
  };
  timestamp: number;
}
```

---

### IErrorMessage

错误消息（服务器 → 客户端）。

```typescript
interface IErrorMessage {
  type: "ERROR";
  data: {
    code: EWSErrorCode;
    message: string;
    context?: any;
  };
  timestamp: number;
}
```

---

### IASRTextPushMessage

推送识别文本消息（客户端 → 服务器）。

客户端从腾讯云 ASR 收到识别结果后，通过此消息推送到服务器。

```typescript
interface IASRTextPushMessage {
  type: "ASR_TEXT_PUSH";
  data: {
    roomId: string;      // 房间ID
    speakerId: string;   // 发言者 userId
    seq: number;         // 序列号（从0开始，单调递增）
    text: string;        // 识别的文本内容
    isFinal: boolean;    // false=Partial, true=Final
  };
  timestamp: number;
}
```

**字段说明**:
- `seq`: 用于去重，每次新的录音会话从 0 开始
- `isFinal`: `false` 表示实时文本（会被覆盖），`true` 表示最终文本（固化）

---

### IASRTextMessage

接收识别文本消息（服务器 → 客户端，广播）。

服务器验证和处理后的识别文本，广播给房间内所有参与者。

```typescript
interface IASRTextMessage {
  type: "ASR_TEXT";
  data: {
    roomId: string;      // 房间ID
    speakerId: string;   // 发言者 userId
    seq: number;         // 序列号
    text: string;        // 识别的文本内容
    isFinal: boolean;    // false=Partial, true=Final
  };
  timestamp: number;
}
```

**关键特性**:
- Partial 消息被节流到 200ms 间隔
- Final 消息立即广播
- 广播给房间内所有参与者（包括发言者）

---

## 数据存储

### 内存存储结构

当前版本使用内存 Map 存储：

```typescript
// RoomManager — 房间状态
class RoomManager {
  private roomsById: Map<string, IRoom>;      // roomId → Room
  private roomsByCode: Map<string, string>;   // roomCode → roomId
}

// ConnectionManager — 连接映射
class ConnectionManager {
  private connections: Map<string, { socket, userId?, roomId? }>;  // connectionId → 连接数据
  private userConnections: Map<string, string>;  // userId → connectionId
  private roomConnections: Map<string, Set<string>>;  // roomId → Set<connectionId>
}

// DrumGameManager — 游戏状态
class DrumGameManager {
  private games: Map<string, IDrumGameState>;  // roomId → 游戏状态
}

// AsrTextHandler — ASR 同步状态
class AsrTextHandler {
  private sessionStates: Map<string, IASRSessionState>;  // "${roomId}:${speakerId}" → State
}
```

### 索引策略

| 存储 | 索引键 | 值 | 用途 |
|------|--------|----|----|
| RoomManager.roomsById | roomId | IRoom | 根据 ID 查找房间 |
| RoomManager.roomsByCode | roomCode | roomId | 根据代码查找房间 |
| ConnectionManager.connections | connectionId | 连接数据 | 消息路由 |
| ConnectionManager.userConnections | userId | connectionId | 用户查找连接 |
| ConnectionManager.roomConnections | roomId | Set\<connectionId\> | 房间广播 |
| DrumGameManager.games | roomId | IDrumGameState | 游戏状态查找 |
| AsrTextHandler.sessionStates | `${roomId}:${speakerId}` | IASRSessionState | ASR 去重/节流 |

---

## 数据验证

### Zod Schema

使用 Zod 进行运行时验证：

```typescript
// 创建房间请求验证
const createRoomSchema = z.object({
  creator: z.object({
    userId: z.string().min(1),
    nickname: z.string().min(1)
  })
});

// JOIN_ROOM 消息验证
const joinRoomMessageSchema = z.object({
  type: z.literal('JOIN_ROOM'),
  data: z.object({
    roomCode: z.string().length(6),
    user: z.object({
      userId: z.string().min(1),
      nickname: z.string().min(1)
    })
  }),
  timestamp: z.number()
});
```

---

## 数据流图

### 创建房间流程

```
客户端                   后端                   内存存储
   |                      |                        |
   |-- ICreateRoomRequest ->|                        |
   |                      |-- 生成 IRoom          |
   |                      |-- 保存到 Map -------->|
   |                      |                        |
   |<- ICreateRoomResponse-|                        |
```

### 加入房间流程

```
客户端                   后端                   内存存储
   |                      |                        |
   |-- IJoinRoomMessage -->|                        |
   |                      |-- 查找房间 <----------|
   |                      |-- 验证状态            |
   |                      |-- 添加参与者          |
   |                      |-- 更新房间 ---------->|
   |                      |                        |
   |<- IJoinAckMessage ---|                        |
```

### 发送消息流程

```
客户端                   后端                   内存存储
   |                      |                        |
   |-- IChatSendMessage -->|                        |
   |                      |-- 查找房间 <----------|
   |                      |-- 构建 IMessage       |
   |                      |                        |
   |<- IChatReceiveMessage-|                        |
   |  (广播给所有人)      |                        |
```

---

## 类型关系图

```
IRoom
├── roomId: string
├── roomCode: string
├── hostUserId: string
├── participants: IParticipant[]
│   └── IParticipant
│       ├── user: IUser
│       │   ├── userId: string
│       │   └── nickname: string
│       └── joinedAt: number
├── status: ERoomStatus
│   ├── WAITING
│   ├── READY
│   └── CLOSED
└── createdAt: number

IMessage
├── messageId: string
├── roomId: string
├── sender: IUser
├── type: EMessageType
│   └── TEXT
├── content: IMessageContent
│   └── { type: "TEXT", text: string }
└── createdAt: number

IDrumGameState
├── roomId: string
├── phase: EGamePhase
│   ├── WAITING
│   ├── COUNTDOWN
│   ├── RUNNING
│   └── FINISHED
├── organizerScore: number
├── joinerScore: number
├── startAtMs?: number
└── endAtMs?: number

IASRSessionState (内部状态)
├── lastSeq: number
├── finalReceived: boolean
├── pendingPartial?: IASRTextPushMessage
└── throttleTimer?: NodeJS.Timeout

IJudgmentResponse
├── caseNumber: string
├── responsibility
│   ├── player1: number
│   ├── player2: number
│   └── thirdParty
│       └── factors: IThirdPartyFactor[]
│           ├── name: string
│           └── percentage: number
├── radarChart
│   ├── player1: IRadarScores (6 维度)
│   └── player2: IRadarScores (6 维度)
└── verdict: string
```

---

## 常见问题

### Q1: 为什么 User 没有 ID？

有 `userId` 字段，但它由客户端生成，服务器不管理用户账户系统。

### Q2: 消息会被持久化吗？

当前版本不持久化，仅实时转发。未来版本会添加消息历史功能。

### Q3: roomCode 和 roomId 有什么区别？

- `roomId`: 服务器内部使用（UUID）
- `roomCode`: 用户分享使用（6位代码）

### Q4: 为什么需要 IConnectionData？

分离运行时连接数据和领域模型，`IConnectionData` 仅用于 WebSocket 连接管理。

---

## 相关文档

- [返回文档首页](README.md)
- [创建房间](features/01-room-creation.md)
- [加入房间](features/02-join-room.md)
- [聊天消息](features/03-chat-messaging.md)
- [错误处理](features/05-error-handling.md)
- [震天鼓游戏](features/06-drum-game.md)
- [ASR 实时语音识别](features/07-asr-real-time-speech.md)
- [腾讯云 STS Token](features/08-tencent-sts-token.md)
- [LLM 判决书生成](features/09-llm-judgment.md)
- [表情互动消息](features/10-emoji-messages.md)
