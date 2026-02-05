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

**Endpoint**: `POST /room/create`

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
curl -X POST http://localhost:8080/room/create \
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

**Endpoint**: `GET /tencent/credentials`

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
curl -X GET http://localhost:8080/tencent/credentials
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

#### 3.1 开始 ASR 会话 (ASR_START)

**方向**: Client → Server

**描述**: 用户按下麦克风按钮时，创建 ASR 会话

**消息格式**:
```typescript
{
  "type": "ASR_START",
  "data": {
    "roomId": string,      // 房间ID
    "speakerId": string,   // 发言者 userId
    "sessionId": string    // 客户端生成的会话ID（UUID）
  },
  "timestamp": number
}
```

**验证规则**:
- 发言者必须是房间参与者
- sessionId 必须唯一（幂等性控制）

**错误代码**:
- `ROOM_NOT_FOUND`: 房间不存在
- `NOT_PARTICIPANT`: 用户不是房间参与者
- `ASR_SERVICE_ERROR`: ASR 服务连接失败

---

#### 3.2 发送音频数据 (ASR_AUDIO)

**方向**: Client → Server

**描述**: 持续发送音频分片给服务器

**消息格式**:
```typescript
{
  "type": "ASR_AUDIO",
  "data": {
    "roomId": string,
    "sessionId": string,   // 会话ID
    "seq": number,         // 音频帧序号（从1开始，单调递增）
    "audio": string,       // Base64 编码的音频数据
    "format": "pcm" | "opus",  // 音频格式
    "sampleRate": number   // 采样率（Hz）
  },
  "timestamp": number
}
```

**音频规范**:
- 格式: PCM 16位单声道 / Opus
- 采样率: 16000 Hz（推荐）
- 分片大小: 建议 3.2KB（对应 100ms 的 PCM）
- 发送频率: 建议 100-200ms 间隔

**幂等性**: 
- `seq ≤ lastSeq` 的帧会被丢弃
- 会话已结束的音频会被丢弃

**错误代码**:
- `SESSION_NOT_FOUND`: 会话不存在或已结束
- `AUDIO_FORMAT_ERROR`: 音频格式错误

---

#### 3.3 停止 ASR 会话 (ASR_STOP)

**方向**: Client → Server

**描述**: 用户松开麦克风或倒计时结束时，结束 ASR 会话

**消息格式**:
```typescript
{
  "type": "ASR_STOP",
  "data": {
    "roomId": string,
    "sessionId": string    // 会话ID
  },
  "timestamp": number
}
```

**行为**:
- 服务器关闭与腾讯云的连接
- 等待最后的 Final 文本（约5秒）
- 清理会话资源

**幂等性**: 重复 STOP 会被忽略

---

#### 3.4 接收识别文本 (ASR_TEXT)

**方向**: Server → All Participants (广播)

**描述**: 服务器广播识别的文本结果

**消息格式**:
```typescript
{
  "type": "ASR_TEXT",
  "data": {
    "roomId": string,
    "speakerId": string,   // 发言者 userId
    "sessionId": string,   // 会话ID
    "isFinal": boolean,    // false=实时文本（可覆盖），true=最终文本（固化）
    "text": string,        // 识别文本
    "confidence": number   // 置信度（0-1）
  },
  "timestamp": number
}
```

**文本类型**:
- **Partial** (`isFinal: false`): 实时识别的中间结果，会不断更新覆盖
- **Final** (`isFinal: true`): 最终确认的文本，不再变化

**关键行为**:
- ✅ 广播给房间内所有参与者
- ✅ 新的 Partial 覆盖旧 Partial
- ✅ Final 出现后，文本固定，不再接受 Partial 更新

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

| 错误代码 | 描述 |
|---------|------|
| `INVALID_PAYLOAD` | 消息格式错误或缺少必需字段 |
| `ROOM_NOT_FOUND` | 房间代码不存在 |
| `ROOM_FULL` | 房间已满（已有2名参与者） |
| `ROOM_CLOSED` | 房间已关闭 |
| `ALREADY_JOINED` | 用户已在房间中 |
| `NOT_PARTICIPANT` | 用户不是房间参与者 |
| `ROOM_NOT_READY` | 房间未就绪（参与者不足2人） |
| `SESSION_NOT_FOUND` | ASR 会话不存在或已结束 |
| `ASR_SERVICE_ERROR` | ASR 服务连接失败 |
| `AUDIO_FORMAT_ERROR` | 音频格式错误 |
| `INTERNAL_ERROR` | 服务器内部错误 |

---

## 完整流程示例

### 场景：两个用户创建房间并聊天

#### 第一步：用户A创建房间

**HTTP Request**:
```bash
POST /room/create
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

