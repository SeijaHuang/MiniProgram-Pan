# 后端 API 规格说明

## 概述

双人聊天室系统后端服务，提供 HTTP REST API 和 WebSocket 实时通信接口。

### 技术栈

- **Runtime**: Node.js + TypeScript
- **HTTP Server**: Express
- **WebSocket**: ws library
- **Architecture**: 三层架构（Controller → Service → Repository）

### 核心特性

- ✅ 严格的双人房间限制（最多 2 名参与者）
- ✅ 房间状态机管理（WAITING → READY → CLOSED）
- ✅ HTTP 用于房间创建，WebSocket 用于实时通信
- ✅ 完整的类型安全和错误处理
- ✅ 消息广播机制（服务器权威）

---

## 服务器信息

### 开发环境

- **HTTP Server**: `http://localhost:8080`
- **WebSocket Server**: `ws://localhost:8080/ws`

### 生产环境

- 配置通过环境变量 `PORT` 和 `WS_PATH` 设置

---

## HTTP API

### 1. 创建房间

**Endpoint**: `POST /v1/rooms`

**描述**: 创建一个新的双人聊天室

#### Request

**Headers**:
```
Content-Type: application/json
```

**Body**:
```typescript
{
  "creator": {
    "userId": string,    // 创建者用户ID
    "nickname": string   // 创建者昵称
  }
}
```

**验证规则**:
- `userId`: 必填，字符串，长度 > 0
- `nickname`: 必填，字符串，长度 > 0

#### Response

**成功响应** (201 Created):
```typescript
{
  "success": true,
  "data": {
    "room": {
      "roomId": string,        // 房间唯一ID
      "roomCode": string,      // 6位房间代码（用于邀请）
      "hostUserId": string,    // 房主用户ID
      "participants": [],      // 参与者列表（初始为空）
      "status": "WAITING",     // 房间状态
      "createdAt": number      // 创建时间戳
    }
  }
}
```

**错误响应** (400 Bad Request):
```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": string  // 具体错误信息
  }
}
```

**错误响应** (500 Internal Server Error):
```typescript
{
  "success": false,
  "error": {
    "code": "ROOM_CREATE_FAILED",
    "message": string
  }
}
```

#### 示例

**cURL**:
```bash
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "creator": {
      "userId": "user_123",
      "nickname": "Alice"
    }
  }'
```

**成功响应示例**:
```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "room_1737878400000_abc123",
      "roomCode": "A1B2C3",
      "hostUserId": "user_123",
      "participants": [],
      "status": "WAITING",
      "createdAt": 1737878400000
    }
  }
}
```

---

### 2. 获取腾讯云 STS Token

**Endpoint**: `GET /v1/tencent/credentials`

**描述**: 获取腾讯云临时安全凭证（STS Token），用于客户端直连腾讯云 ASR 服务

#### Request

**Headers**:
```
无需特殊 headers
```

**Query Parameters**: 无

#### Response

**成功响应** (200 OK):
```typescript
{
  "Credentials": {
    "Token": string,           // 临时安全令牌
    "TmpSecretId": string,     // 临时 SecretId
    "TmpSecretKey": string     // 临时 SecretKey
  },
  "Expiration": string,        // 过期时间（ISO 8601 格式）
  "ExpiredTime": number,       // 过期时间戳（秒）
  "RequestId": string          // 请求ID
}
```

**错误响应** (500 Internal Server Error):
```typescript
{
  "success": false,
  "error": {
    "code": "STS_GET_FAILED",
    "message": string  // 具体错误信息
  }
}
```

#### 示例

**cURL**:
```bash
curl -X GET http://localhost:8080/v1/tencent/credentials
```

**成功响应示例**:
```json
{
  "Credentials": {
    "Token": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "TmpSecretId": "AKIDxxxxxxxxxxxxxx",
    "TmpSecretKey": "xxxxxxxxxxxxxxxx"
  },
  "Expiration": "2026-02-02T12:00:00Z",
  "ExpiredTime": 1738497600,
  "RequestId": "abcd1234-5678-90ef-ghij-klmnopqrstuv"
}
```

**使用场景**:
- 小程序客户端在开始 ASR 会话前，先调用此接口获取临时凭证
- 使用临时凭证直连腾讯云实时语音识别服务
- Token 有效期通常为 1-2 小时，过期前需重新获取

**安全说明**:
- 使用 STS 临时凭证代替永久密钥，提高安全性
- 临时凭证权限被限制为仅能访问 ASR 服务（`name/asr:*`）
- 即使凭证泄露，影响范围也被限制且有时效性

---

## WebSocket API

### 连接

**URL**: `ws://localhost:8080/ws`

**协议**: WebSocket Protocol

**连接生命周期**:
1. 客户端连接到 WebSocket URL
2. 服务器分配唯一 `connectionId`
3. 客户端发送消息进行身份验证和操作
4. 连接关闭时自动清理资源

### 消息协议

所有 WebSocket 消息遵循统一格式：

```typescript
{
  "type": string,      // 消息类型
  "data": object,      // 消息数据
  "timestamp": number  // 消息时间戳
}
```

### 支持的消息类型

| 消息类型 | 方向 | 功能模块 | 说明 |
|---------|------|---------|------|
| `JOIN_ROOM` | Client → Server | 房间管理 | 加入房间 |
| `JOIN_ACK` | Server → Client | 房间管理 | 确认加入（广播） |
| `CHAT_SEND` | Client → Server | 聊天 | 发送文本消息 |
| `CHAT_RECEIVE` | Server → Client | 聊天 | 接收消息（广播） |
| `ASR_TEXT_PUSH` | Client → Server | 语音识别 | 推送识别文本 |
| `ASR_TEXT` | Server → Client | 语音识别 | 广播识别文本 |
| `DRUM_READY` | Server → Client | 震天鼓游戏 | 游戏准备 |
| `DRUM_START` | Server → Client | 震天鼓游戏 | 游戏开始 |
| `DRUM_TAP` | Bidirectional | 震天鼓游戏 | 点击事件 |
| `DRUM_FINISH` | Server → Client | 震天鼓游戏 | 游戏结束 |
| `DRUM_RESULT` | Server → Client | 震天鼓游戏 | 最终结果 |
| `ERROR` | Server → Client | 错误处理 | 错误通知 |

---

### 1. 加入房间 (JOIN_ROOM)

**方向**: Client → Server

**描述**: 用户通过房间代码加入房间

#### 消息格式

```typescript
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": string,  // 6位房间代码
    "user": {
      "userId": string,  // 用户ID
      "nickname": string // 用户昵称
    }
  },
  "timestamp": number
}
```

#### 成功响应: JOIN_ACK

**方向**: Server → All Participants (广播)

**描述**: 服务器向房间内所有参与者广播更新后的房间状态

```typescript
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomId": string,
      "roomCode": string,
      "hostUserId": string,
      "participants": [
        {
          "user": {
            "userId": string,
            "nickname": string
          },
          "joinedAt": number
        }
      ],
      "status": "WAITING" | "READY",  // 2人时变为READY
      "createdAt": number
    }
  },
  "timestamp": number
}
```

**关键行为**:
- ✅ 消息广播给房间内**所有参与者**（包括刚加入的用户）
- ✅ 当第二个用户加入时，`status` 自动变为 `"READY"`
- ✅ 所有客户端接收到相同的房间状态（服务器权威）

#### 错误响应: ERROR

```typescript
{
  "type": "ERROR",
  "data": {
    "code": string,      // 错误代码
    "message": string    // 错误描述
  },
  "timestamp": number
}
```

**错误代码**:
- `ROOM_NOT_FOUND`: 房间不存在
- `ROOM_FULL`: 房间已满（2人限制）
- `ROOM_CLOSED`: 房间已关闭
- `ALREADY_JOINED`: 用户已在房间中
- `INVALID_PAYLOAD`: 消息格式错误

---

### 2. 发送聊天消息 (CHAT_SEND)

**方向**: Client → Server

**描述**: 参与者发送聊天消息

#### 消息格式

```typescript
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",    // 消息类型（目前仅支持TEXT）
      "text": string     // 消息文本内容
    }
  },
  "timestamp": number
}
```

**验证规则**:
- 发送者必须是房间参与者
- 房间状态必须为 `READY`（2人就位）
- `text` 长度 > 0

#### 成功响应: CHAT_RECEIVE

**方向**: Server → All Participants (广播)

**描述**: 服务器向房间内所有参与者广播消息

```typescript
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": string,     // 服务器生成的消息ID
      "roomId": string,        // 所属房间ID
      "sender": {
        "userId": string,
        "nickname": string
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": string
      },
      "createdAt": number      // 服务器时间戳
    }
  },
  "timestamp": number
}
```

**关键行为**:
- ✅ 服务器生成唯一 `messageId` 和 `createdAt`
- ✅ 消息广播给房间内**所有参与者**（包括发送者）
- ✅ 所有客户端接收到相同的消息数据（服务器权威）

#### 错误响应: ERROR

```typescript
{
  "type": "ERROR",
  "data": {
    "code": string,
    "message": string
  },
  "timestamp": number
}
```

**错误代码**:
- `NOT_PARTICIPANT`: 发送者不在房间中
- `ROOM_NOT_READY`: 房间未就绪（未满2人）
- `INVALID_PAYLOAD`: 消息格式错误

---

### 3. ASR 实时语音识别

ASR（Automatic Speech Recognition）功能为 Chat Room 提供实时语音转文字能力。

**架构说明**: 客户端直接连接腾讯云 ASR 服务进行语音识别，然后通过 WebSocket 将识别结果同步给服务器，服务器负责广播给其他参与者。

**前置条件**: 客户端需要先调用 `GET /v1/tencent/credentials` 获取临时凭证。

---

#### 3.1 推送识别文本 (ASR_TEXT_PUSH)

**方向**: Client → Server

**描述**: 发言者将本地 ASR 识别的文本推送到服务器，服务器进行去重和节流后广播给其他参与者

**消息格式**:
```typescript
{
  "type": "ASR_TEXT_PUSH",
  "data": {
    "roomId": string,      // 房间ID
    "speakerId": string,   // 发言者 userId（必须与连接的 userId 一致）
    "seq": number,         // 序列号（从0开始，单调递增，用于去重）
    "text": string,        // 识别的文本内容
    "isFinal": boolean     // false=实时文本（可覆盖），true=最终文本（固化）
  },
  "timestamp": number
}
```

**验证规则**:
- 发言者必须是房间参与者
- `speakerId` 必须与连接的 `userId` 一致
- `roomId` 必须与连接的 `roomId` 一致
- 房间状态必须为 `READY`（2人就位）
- `seq` 必须单调递增（用于去重）

**去重和节流机制**:
- **去重**: `seq ≤ lastSeq` 的消息会被丢弃
- **节流**: Partial 消息会被节流到 200ms 间隔
- **Final 优先**: Final 消息立即广播，清除待处理的 Partial
- **会话隔离**: Final 后的旧消息会被忽略

**错误代码**:
- `ROOM_NOT_FOUND`: 房间不存在
- `NOT_PARTICIPANT`: 用户不是房间参与者
- `ROOM_NOT_READY`: 房间未就绪（未满2人）
- `INVALID_PAYLOAD`: 消息格式错误

---

#### 3.2 接收识别文本 (ASR_TEXT)

**方向**: Server → All Participants (广播)

**描述**: 服务器将验证和处理后的识别文本广播给房间内所有参与者

**消息格式**:
```typescript
{
  "type": "ASR_TEXT",
  "data": {
    "roomId": string,
    "speakerId": string,   // 发言者 userId
    "seq": number,         // 序列号
    "text": string,        // 识别文本
    "isFinal": boolean     // false=实时文本（可覆盖），true=最终文本（固化）
  },
  "timestamp": number
}
```

**文本类型**:
- **Partial** (`isFinal: false`): 实时识别的中间结果，会不断更新覆盖
- **Final** (`isFinal: true`): 最终确认的文本，不再变化

**关键行为**:
- ✅ 广播给房间内所有参与者（包括发言者）
- ✅ 服务器端节流：Partial 消息最多 200ms 发送一次
- ✅ Final 消息立即发送，不节流
- ✅ 新的 Partial 覆盖旧 Partial
- ✅ Final 出现后，该语句的识别结束

**使用流程**:
```
1. 客户端获取 STS Token (GET /v1/tencent/credentials)
   ↓
2. 客户端使用临时凭证连接腾讯云 ASR
   ↓
3. 客户端录音并实时获取识别结果
   ↓
4. 客户端通过 ASR_TEXT_PUSH 推送识别结果到服务器
   ↓
5. 服务器验证、去重、节流后广播 ASR_TEXT 给其他参与者
   ↓
6. 其他参与者实时看到发言者的语音转文字
```

---

### 4. 震天鼓游戏 (DRUM)

震天鼓游戏是双人实时竞技小游戏，玩家通过点击鼓面竞争，获胜者获得优先发言权。

**游戏时长**: 10秒（可配置）
**触发时机**: 房间满员（2人）后自动开始

#### 游戏流程

```
房间满员 → 等待3秒 → DRUM_READY → DRUM_START → 游戏进行(10秒) → DRUM_FINISH → DRUM_RESULT
```

#### WebSocket 消息类型

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `DRUM_READY` | Server → Client | 游戏准备，同步服务器时间和玩家信息 |
| `DRUM_START` | Server → Client | 游戏开始信号 |
| `DRUM_TAP` | Bidirectional | 点击事件（客户端发送，服务器广播） |
| `DRUM_FINISH` | Server → Client | 游戏结束信号 |
| `DRUM_RESULT` | Server → Client | 最终结果和获胜者 |

**详细文档**: 查看 [震天鼓游戏详细文档](features/06-drum-game.md) 了解完整的消息格式和游戏机制。

---

## 数据模型

### Room（房间）

```typescript
interface IRoom {
  roomId: string;        // 唯一房间ID，格式：room_{timestamp}_{random}
  roomCode: string;      // 6位房间代码，用于邀请
  hostUserId: string;    // 房主用户ID
  participants: IParticipant[];  // 参与者列表（最多2人）
  status: ERoomStatus;   // 房间状态
  createdAt: number;     // 创建时间戳
}

enum ERoomStatus {
  Waiting = "WAITING",   // 等待第二个用户
  Ready = "READY",       // 双方就位
  Closed = "CLOSED"      // 房间已关闭
}

interface IParticipant {
  user: IUser;
  joinedAt: number;      // 加入时间戳
}
```

**状态转换**:
```
WAITING (0人) → [creator creates] → WAITING (1人)
WAITING (1人) → [guest joins] → READY (2人)
READY → [disconnect/close] → CLOSED
```

### User（用户）

```typescript
interface IUser {
  userId: string;    // 用户唯一标识
  nickname: string;  // 用户昵称
}
```

**注意**:
- 用户模型是会话级别的，不涉及持久化账户系统
- `userId` 由客户端生成并维护

### Message（消息）

```typescript
interface IMessage {
  messageId: string;     // 服务器生成的唯一消息ID
  roomId: string;        // 所属房间ID
  sender: IUser;         // 发送者信息
  type: EMessageType;    // 消息类型
  content: IMessageContent;
  createdAt: number;     // 服务器时间戳
}

enum EMessageType {
  Text = "TEXT"
}

type IMessageContent = {
  type: EMessageType.Text;
  text: string;
};
```

---

## 错误代码参考

### HTTP 错误代码

| 错误代码 | HTTP 状态码 | 描述 |
|---------|-----------|------|
| `INVALID_REQUEST` | 400 | 请求参数验证失败 |
| `ROOM_CREATE_FAILED` | 500 | 房间创建失败 |
| `STS_GET_FAILED` | 500 | 获取 STS Token 失败 |

### WebSocket 错误代码

| 错误代码 | 描述 | 适用场景 |
|---------|------|---------|
| `INVALID_PAYLOAD` | 消息格式错误或缺少必需字段 | 所有消息类型 |
| `ROOM_NOT_FOUND` | 房间代码不存在 | JOIN_ROOM, ASR_TEXT_PUSH |
| `ROOM_FULL` | 房间已满（已有2名参与者） | JOIN_ROOM |
| `ROOM_CLOSED` | 房间已关闭 | JOIN_ROOM |
| `ALREADY_JOINED` | 用户已在房间中 | JOIN_ROOM |
| `NOT_PARTICIPANT` | 用户不是房间参与者 | CHAT_SEND, DRUM_TAP, ASR_TEXT_PUSH |
| `ROOM_NOT_READY` | 房间未就绪（参与者不足2人） | CHAT_SEND, ASR_TEXT_PUSH |
| `INTERNAL_ERROR` | 服务器内部错误 | 所有消息类型 |

**注意**: 
- ASR 相关的错误（如音频格式错误、识别服务连接失败等）发生在客户端与腾讯云 ASR 的连接中，不会通过后端 WebSocket 返回
- 后端只负责文本同步，因此只会返回房间和权限相关的错误代码

---

## 完整流程示例

### 场景：两个用户创建房间并聊天

#### 第一步：用户A创建房间

**HTTP Request**:
```bash
POST /v1/rooms
{
  "creator": {
    "userId": "user_alice",
    "nickname": "Alice"
  }
}
```

**HTTP Response**:
```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "room_123456",
      "roomCode": "A1B2C3",
      "hostUserId": "user_alice",
      "participants": [],
      "status": "WAITING",
      "createdAt": 1737878400000
    }
  }
}
```

#### 第二步：用户A连接WebSocket并加入房间

**WebSocket Connection**: `ws://localhost:8080/ws`

**Send (Client → Server)**:
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "user": {
      "userId": "user_alice",
      "nickname": "Alice"
    }
  },
  "timestamp": 1737878401000
}
```

**Receive (Server → Client)**:
```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomId": "room_123456",
      "roomCode": "A1B2C3",
      "hostUserId": "user_alice",
      "participants": [
        {
          "user": {
            "userId": "user_alice",
            "nickname": "Alice"
          },
          "joinedAt": 1737878401000
        }
      ],
      "status": "WAITING",
      "createdAt": 1737878400000
    }
  },
  "timestamp": 1737878401100
}
```

#### 第三步：用户B通过房间代码加入

**WebSocket Connection**: `ws://localhost:8080/ws`

**Send (Client → Server)**:
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "A1B2C3",
    "user": {
      "userId": "user_bob",
      "nickname": "Bob"
    }
  },
  "timestamp": 1737878402000
}
```

**Receive (Server → All Participants)** - 用户A和用户B都收到:
```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomId": "room_123456",
      "roomCode": "A1B2C3",
      "hostUserId": "user_alice",
      "participants": [
        {
          "user": {
            "userId": "user_alice",
            "nickname": "Alice"
          },
          "joinedAt": 1737878401000
        },
        {
          "user": {
            "userId": "user_bob",
            "nickname": "Bob"
          },
          "joinedAt": 1737878402000
        }
      ],
      "status": "READY",  // 状态变为READY
      "createdAt": 1737878400000
    }
  },
  "timestamp": 1737878402100
}
```

#### 第四步：用户A发送消息

**Send (Client → Server)**:
```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hello Bob!"
    }
  },
  "timestamp": 1737878403000
}
```

**Receive (Server → All Participants)** - 用户A和用户B都收到:
```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": "msg_1737878403100_xyz",
      "roomId": "room_123456",
      "sender": {
        "userId": "user_alice",
        "nickname": "Alice"
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": "Hello Bob!"
      },
      "createdAt": 1737878403100
    }
  },
  "timestamp": 1737878403100
}
```

#### 第五步：用户B回复

**Send (Client → Server)**:
```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hi Alice!"
    }
  },
  "timestamp": 1737878404000
}
```

**Receive (Server → All Participants)**:
```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": "msg_1737878404100_abc",
      "roomId": "room_123456",
      "sender": {
        "userId": "user_bob",
        "nickname": "Bob"
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": "Hi Alice!"
      },
      "createdAt": 1737878404100
    }
  },
  "timestamp": 1737878404100
}
```

---

## 设计原则

### 1. 服务器权威 (Server Authority)

- ✅ 所有状态由服务器管理和广播
- ✅ 客户端不能自行修改房间状态
- ✅ 消息ID和时间戳由服务器生成

### 2. 广播机制 (Broadcast Pattern)

- ✅ `JOIN_ACK` 和 `CHAT_RECEIVE` 广播给所有参与者
- ✅ 确保所有客户端状态同步
- ✅ 发送者也接收自己的消息（用于确认）

### 3. 严格的房间限制

- ✅ 每个房间最多2名参与者
- ✅ 房间满员后拒绝新用户加入
- ✅ 房间代码6位，易于分享

### 4. 状态机驱动

- ✅ 房间状态：WAITING → READY → CLOSED
- ✅ 状态转换自动触发
- ✅ 状态验证业务规则

### 5. 类型安全

- ✅ 所有消息和数据模型完全类型化
- ✅ Zod运行时验证
- ✅ TypeScript编译时检查

---

## 测试指南

### 使用 Postman 测试 HTTP API

1. 导入 `backend/postman_collection.json`
2. 测试创建房间接口
3. 复制返回的 `roomCode`

### 使用测试脚本测试 WebSocket

```bash
cd backend
npm run ws:test
```

该脚本模拟两个用户的完整流程。

---

## 扩展性考虑

### 当前架构支持未来扩展：

1. **数据库集成**: Repository 接口已预留
2. **更多消息类型**: `EMessageType` 枚举可扩展
3. **房间持久化**: 当前内存存储可迁移至数据库
4. **用户认证**: 可添加 JWT 或 OAuth
5. **消息历史**: 可添加消息存储和查询接口

### 暂不支持的功能：

- ❌ 群聊（3人以上）
- ❌ 消息历史查询
- ❌ 用户注册/登录
- ❌ 房间持久化（重启后丢失）
- ❌ 文件/图片消息
- ❌ ASR 音频存储和文本持久化

---

## 参考文档

- [腾讯云 STS Token 获取](features/08-tencent-sts-token.md)
- [ASR 实时语音识别详细文档](features/07-asr-real-time-speech.md)
- [震天鼓游戏](features/06-drum-game.md)
- [数据模型](data-models.md)

