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
| `IMAGE` | 图片消息 | ⏳ 未来 |
| `AUDIO` | 语音消息 | ⏳ 未来 |
| `EMOJI` | 表情消息 | ⏳ 未来 |

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

## 数据存储

### 内存存储结构

当前版本使用内存 Map 存储：

```typescript
class RoomRepository {
  private roomsById: Map<string, IRoom>;      // roomId → Room
  private roomsByCode: Map<string, string>;   // roomCode → roomId
}
```

### 索引策略

| 索引 | 键 | 值 | 用途 |
|------|----|----|------|
| `roomsById` | roomId | IRoom | 根据 ID 查找房间 |
| `roomsByCode` | roomCode | roomId | 根据代码查找房间 |

### 数据持久化（未来）

```typescript
// 未来使用 MongoDB
interface IRoomDocument extends IRoom {
  _id: ObjectId;
  updatedAt: number;
}
```

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
