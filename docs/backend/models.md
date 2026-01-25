# Backend Data Models

本文档描述后端数据模型定义，包括领域实体、DTO 和验证模式。

## 领域实体

### IRoom

房间实体，表示一个两人聊天房间。

```typescript
interface IRoom {
    roomId: string; // 房间唯一标识，格式: "room_{hex}"
    roomCode: string; // 6位数字房间码，用于用户加入
    hostUserId: string; // 房主用户ID (创建者)
    participants: IParticipant[]; // 参与者列表，最多2人
    status: ERoomStatus; // 房间状态
    createdAt: number; // 创建时间戳 (毫秒)
}
```

**文件位置**: `backend/src/models/entities/room.ts`

---

### IParticipant

参与者实体，表示房间中的一个参与者。

```typescript
interface IParticipant {
    user: IUser; // 用户信息
    joinedAt: number; // 加入时间戳 (毫秒)
}
```

**文件位置**: `backend/src/models/entities/room.ts`

---

### IUser

用户实体，表示会话级别的用户身份。

```typescript
interface IUser {
    userId: string; // 用户唯一标识
    nickname: string; // 用户昵称
}
```

**文件位置**: `backend/src/models/entities/user.ts`

---

### IMessage

消息实体，表示聊天消息。

```typescript
interface IMessage {
    messageId: string; // 消息唯一标识，格式: "msg_{hex}"
    roomId: string; // 所属房间ID
    sender: IUser; // 发送者
    type: EMessageType; // 消息类型
    content: IMessageContent; // 消息内容
    createdAt: number; // 创建时间戳 (毫秒)
}
```

**文件位置**: `backend/src/models/entities/message.ts`

---

### IMessageContent

消息内容，根据消息类型不同有不同结构。

```typescript
// 文本消息内容
interface ITextContent {
    type: 'TEXT';
    text: string;
}

type IMessageContent = ITextContent; // 当前仅支持文本
```

**文件位置**: `backend/src/models/entities/message.ts`

---

## 枚举类型

### ERoomStatus

房间状态枚举。

```typescript
enum ERoomStatus {
    WAITING = 'WAITING', // 等待中，0-1人
    READY = 'READY', // 就绪，2人已加入
    CLOSED = 'CLOSED', // 已关闭
}
```

**状态流转**:

```
WAITING ──(第2人加入)──▶ READY ──(有人断开)──▶ CLOSED
```

---

### EMessageType

消息类型枚举。

```typescript
enum EMessageType {
    TEXT = 'TEXT', // 文本消息
}
```

---

## DTO (数据传输对象)

### 请求 DTO

#### CreateRoomDTO

创建房间请求。

```typescript
interface ICreateRoomDTO {
    creator: {
        userId: string;
        nickname: string;
    };
}
```

**文件位置**: `backend/src/models/dto/request/create-room.dto.ts`

---

#### JoinRoomDTO

加入房间请求 (WebSocket)。

```typescript
interface IJoinRoomDTO {
    roomCode: string;
    user: {
        userId: string;
        nickname: string;
    };
}
```

**文件位置**: `backend/src/models/dto/request/join-room.dto.ts`

---

#### SendMessageDTO

发送消息请求 (WebSocket)。

```typescript
interface ISendMessageDTO {
    content: {
        type: 'TEXT';
        text: string;
    };
}
```

**文件位置**: `backend/src/models/dto/request/send-message.dto.ts`

---

### 响应 DTO

#### BaseResponseDTO

基础响应结构。

```typescript
interface IBaseResponseDTO<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
```

**文件位置**: `backend/src/models/dto/response/base.response.dto.ts`

---

#### RoomResponseDTO

房间响应。

```typescript
interface IRoomResponseDTO {
    room: IRoom;
}
```

**文件位置**: `backend/src/models/dto/response/room.response.dto.ts`

---

#### MessageResponseDTO

消息响应。

```typescript
interface IMessageResponseDTO {
    message: IMessage;
}
```

**文件位置**: `backend/src/models/dto/response/message.response.dto.ts`

---

#### UserResponseDTO

用户响应。

```typescript
interface IUserResponseDTO {
    user: IUser;
}
```

**文件位置**: `backend/src/models/dto/response/user.response.dto.ts`

---

## Zod 验证模式

使用 Zod 进行运行时类型验证。

### HTTP 请求验证

```typescript
// backend/src/models/schemas/http-request.schema.ts

const userSchema = z.object({
    userId: z.string().min(1),
    nickname: z.string().min(1),
});

const createRoomSchema = z.object({
    creator: userSchema,
});
```

---

### WebSocket 消息验证

```typescript
// backend/src/models/schemas/ws-message.schema.ts

// 加入房间
const joinRoomPayloadSchema = z.object({
    roomCode: z.string().length(6),
    user: userSchema,
});

// 发送消息
const chatSendPayloadSchema = z.object({
    content: z.object({
        type: z.literal('TEXT'),
        text: z.string().min(1),
    }),
});

// 基础消息结构
const wsMessageSchema = z.object({
    type: z.string(),
    data: z.unknown(),
    timestamp: z.number(),
});
```

---

## 类型关系图

```
IUser
  │
  └──▶ IParticipant ──▶ IRoom
  │
  └──▶ IMessage

ICreateRoomDTO ─────────▶ IRoom
IJoinRoomDTO ───────────▶ IParticipant
ISendMessageDTO ────────▶ IMessage

IRoom ──────────────────▶ IRoomResponseDTO
IMessage ───────────────▶ IMessageResponseDTO
IUser ──────────────────▶ IUserResponseDTO
```

---

## ID 生成规则

### Room ID

```typescript
const roomId = `room_${randomBytes(8).toString('hex')}`;
// 示例: "room_a1b2c3d4e5f6g7h8"
```

### Room Code

```typescript
const roomCode = Math.random().toString().slice(2, 8);
// 示例: "123456" (6位数字)
```

### Message ID

```typescript
const messageId = `msg_${randomBytes(6).toString('hex')}`;
// 示例: "msg_x1y2z3a4b5c6"
```

---

## 数据存储

### 当前实现 (内存存储)

```typescript
// RoomManager 中的内存存储
class RoomManager {
    private rooms: Map<string, IRoom> = new Map();
    private roomCodeIndex: Map<string, string> = new Map(); // roomCode -> roomId
}
```

### 未来实现 (数据库)

Repository 接口已定义，准备好数据库集成：

```typescript
interface IRoomRepository {
    findById(roomId: string): Promise<IRoom | null>;
    findByCode(roomCode: string): Promise<IRoom | null>;
    save(room: IRoom): Promise<IRoom>;
    update(room: IRoom): Promise<IRoom>;
    delete(roomId: string): Promise<void>;
    findActiveRooms(): Promise<IRoom[]>;
}
```

---

## 最佳实践

1. **接口命名**: 使用 `I` 前缀 (如 `IUser`, `IRoom`)
2. **枚举命名**: 使用 `E` 前缀 (如 `ERoomStatus`)
3. **DTO 命名**: 使用 `DTO` 后缀 (如 `ICreateRoomDTO`)
4. **时间戳**: 统一使用毫秒级时间戳
5. **ID 格式**: 使用前缀标识类型 (如 `room_`, `msg_`)
