# 后端文档中心

双人聊天室后端服务 + 异步 LLM 判决系统。

## 技术栈

| 类别         | 技术                                           |
| ------------ | ---------------------------------------------- |
| Runtime      | Node.js 18+                                    |
| Language     | TypeScript 5+ (strict, no `any`)               |
| HTTP         | Express 5                                      |
| WebSocket    | ws library                                     |
| Database     | In-memory (room-manager.ts)                    |
| Validation   | Zod                                            |
| LLM          | OpenAI API (gpt-4o)                            |
| Architecture | Routes → Controllers → Services → Repositories |

## 特性

### 核心功能

- ✅ **双人房间系统**: 严格的2人房间限制，房间代码邀请机制
- ✅ **震天鼓游戏**: 实时竞技小游戏，决定发言顺序
- ✅ **实时聊天**: WebSocket 双向通信，消息广播
- ✅ **语音识别（ASR）**: 客户端直连腾讯云 ASR，后端负责文本同步
- ✅ **STS Token 服务**: 为客户端提供临时安全凭证

### 技术特性

- ✅ **房间状态机**: WAITING → READY → CLOSED
- ✅ **完整的错误处理**: 统一错误码和验证
- ✅ **TypeScript 类型安全**: 所有接口完全类型化
- ✅ **三层架构设计**: Controller → Service → Repository
- ✅ **去重和节流**: ASR 文本同步优化机制

---

## 📚 完整文档导航

### 功能特性文档

按功能模块划分的详细实现文档：

| 文档 | 描述 | 路径 |
|------|------|------|
| 🏠 [创建房间](docs/features/01-room-creation.md) | HTTP API 创建房间流程 | `POST /v1/rooms` |
| 🔌 [加入房间](docs/features/02-join-room.md) | WebSocket 加入房间协议 | `JOIN_ROOM` 消息 |
| 💬 [聊天消息](docs/features/03-chat-messaging.md) | 实时聊天消息收发 | `CHAT_SEND/RECEIVE` |
| 🔗 [连接管理](docs/features/04-connection-lifecycle.md) | WebSocket 连接生命周期 | 连接/断开处理 |
| ⚠️ [错误处理](docs/features/05-error-handling.md) | 统一错误码和处理机制 | 错误响应规范 |
| 🥁 [震天鼓游戏](docs/features/06-drum-game.md) | 击鼓游戏机制 | `DRUM_TAP` 消息 |
| 🎤 [ASR 语音识别](docs/features/07-asr-real-time-speech.md) | 实时语音转文字 | `ASR_*` 消息 |
| 🔑 [腾讯云 STS Token](docs/features/08-tencent-sts-token.md) | 获取临时安全凭证 | `GET /v1/tencent/credentials` |

### 核心概念文档

| 文档 | 描述 |
|------|------|
| 📊 [数据模型](docs/data-models.md) | Room, User, Message 等实体定义 |
| 🏗️ [架构可视化](docs/architecture-visual.md) | 三层架构可视化和文件结构 |
| 📋 [产品需求](docs/product-requirements.md) | 完整的功能需求和验收标准 |
| 📡 [API 完整规格](docs/api-specification.md) | 所有 API 的详细规格说明 |

---

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）:

```env
# 基础配置
PORT=8080
NODE_ENV=development

# 腾讯云配置（用于 ASR 语音识别服务）
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_REGION=ap-guangzhou
```

**注意**: 如果需要使用 ASR（语音识别）功能，必须配置腾讯云相关环境变量。

**注意**: 如果需要使用 ASR（语音识别）功能，必须配置腾讯云相关环境变量。

### 3. 启动服务

需要同时运行两个进程：

```bash
# 终端 1：API 服务器
npm run dev

# 终端 2：LLM Worker（判决任务处理）
npm run worker:llm
```

服务器: `http://localhost:8080`
WebSocket: `ws://localhost:8080/ws`

### 4. 验证

```bash
# 健康检查（含数据库连通性）
curl http://localhost:8080/health

# 创建房间
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'

# WebSocket 测试
npm run ws:test
```

**测试腾讯云 STS Token：**

```bash
curl http://localhost:8080/v1/tencent/credentials
```

---

## 开发命令

```bash
# --- API 服务器 ---
npm run dev              # 开发模式（ts-node，热重载）
npm run build            # 编译 TypeScript
npm start                # 运行编译产物 dist/index.js

# --- LLM Worker ---
npm run worker:llm       # 开发模式（ts-node）
npm run worker:llm:prod  # 生产模式（需先 npm run build）

# --- 代码质量 ---
npm run lint             # ESLint 检查
npm run lint:fix         # ESLint 自动修复
npm run format           # Prettier 格式化
npm run format:check     # Prettier 检查
npx tsc --noEmit         # TypeScript 类型检查

# --- 测试 ---
npm run ws:test          # WebSocket 连接测试
npm run test:llm         # LLM 模块 E2E 自测
```

---

## 项目结构

```
backend/src/
├── routes/                 # HTTP 路由
├── controllers/            # 控制器 (HTTP/WebSocket)
├── services/
│   ├── core/               # 核心业务 (RoomService)
│   ├── websocket/          # WebSocket 管理
│   │   ├── connection-manager.ts
│   │   ├── room-manager.ts
│   │   └── drum-game-manager.ts
│   └── handlers/           # 消息处理器
│       ├── join-room-handler.ts
│       ├── chat-send-handler.ts
│       ├── drum-tap-handler.ts
│       └── asr-text-handler.ts
├── models/
│   ├── entities/           # 领域实体 (Room, User, Message)
│   ├── schemas/            # Zod 验证
│   ├── dto/                # 数据传输对象
│   └── enums/              # 枚举类型
├── middlewares/            # 中间件
├── types/                  # TypeScript 类型
├── constants/              # 常量配置
└── utils/                  # 工具函数
```

## API 文档

### HTTP API

#### POST /v1/rooms

创建新房间。

**请求**:

```json
{
    "hostText": "我每天加班到很晚，非常辛苦",
    "participantText": "我也很辛苦，而且工资更低",
    "idempotencyKey": "room123_round1"
}
```

**响应** (200):

```json
{
    "success": true,
    "data": {
        "taskId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "queued"
    }
}
```

#### GET /v1/llm/tasks/:taskId

**响应** (200 - succeeded):

```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "room_abc123",
      "roomCode": "123456",
      "status": "WAITING",
      "participants": [...]
    }
  }
}
```

#### GET /v1/tencent/credentials

获取腾讯云临时安全凭证（用于 ASR 服务）。

**响应** (200):
```json
{
  "Credentials": {
    "Token": "temporary_token",
    "TmpSecretId": "temp_id",
    "TmpSecretKey": "temp_key"
  },
  "Expiration": "2026-02-02T12:00:00Z",
  "ExpiredTime": 1738497600
}
```

#### GET /health

健康检查。

```bash
curl http://localhost:8080/health
# 预期: {"ok":true}
```

# 查看容器状态
docker-compose ps
```

---

## 📡 API 使用

### 核心概念

**房间状态机**:
```
CREATE (HTTP) → WAITING (1人) → READY (2人) → CLOSED (删除)
```

**协议**:
- HTTP: 创建房间 `POST /v1/rooms`
- HTTP: 获取腾讯云 STS Token `GET /v1/tencent/credentials`
- WebSocket: 加入房间、实时聊天、语音识别、震天鼓游戏 `ws://localhost:8080/ws`

### WebSocket 消息类型

| 消息类型 | 方向 | 功能 |
|---------|------|------|
| `JOIN_ROOM` | Client → Server | 加入房间 |
| `JOIN_ACK` | Server → Client | 确认加入（广播） |
| `CHAT_SEND` | Client → Server | 发送文本消息 |
| `CHAT_RECEIVE` | Server → Client | 接收消息（广播） |
| `EMOJI_SEND` | Client → Server | 发送 Emoji 表情 |
| `EMOJI_RECEIVE` | Server → Client | 接收 Emoji（广播） |
| `ASR_TEXT_PUSH` | Client → Server | 推送语音识别文本 |
| `ASR_TEXT` | Server → Client | 广播识别文本 |
| `DRUM_READY` | Server → Client | 游戏准备 |
| `DRUM_START` | Server → Client | 游戏开始 |
| `DRUM_TAP` | Bidirectional | 点击事件 |
| `DRUM_FINISH` | Server → Client | 游戏结束 |
| `DRUM_RESULT` | Server → Client | 最终结果 |
| `ERROR` | Server → Client | 错误通知 |

### WebSocket 消息格式详解

#### 1. 加入房间 (JOIN_ROOM / JOIN_ACK)

**Client → Server: JOIN_ROOM**

```json
{
    "type": "JOIN_ROOM",
    "data": {
        "roomCode": "A1B2C3",
        "user": {
            "userId": "user_alice_1738426800000",
            "nickname": "Alice"
        }
    },
    "timestamp": 1738426800000
}
```

**Server → Client: JOIN_ACK** (广播给房间内所有用户)

```json
{
    "type": "JOIN_ACK",
    "data": {
        "room": {
            "roomId": "room_A1B2C3_1738426800000",
            "roomCode": "A1B2C3",
            "status": "READY",
            "hostUserId": "user_alice_1738426800000",
            "participants": [
                {
                    "user": {
                        "userId": "user_alice_1738426800000",
                        "nickname": "Alice"
                    },
                    "joinedAt": 1738426800000
                },
                {
                    "user": {
                        "userId": "user_bob_1738426810000",
                        "nickname": "Bob"
                    },
                    "joinedAt": 1738426810000
                }
            ],
            "createdAt": 1738426800000
        }
    },
    "timestamp": 1738426810100
}
```

#### 2. 文字聊天 (CHAT_SEND / CHAT_RECEIVE)

**Client → Server: CHAT_SEND**

```json
{
    "type": "CHAT_SEND",
    "data": {
        "content": {
            "type": "TEXT",
            "text": "Hello, world!"
        }
    },
    "timestamp": 1738426850000
}
```

**Server → Client: CHAT_RECEIVE** (广播给房间内所有用户)

```json
{
    "type": "CHAT_RECEIVE",
    "data": {
        "message": {
            "messageId": "msg_abc123",
            "roomId": "room_A1B2C3_1738426800000",
            "sender": {
                "userId": "user_alice_1738426800000",
                "nickname": "Alice"
            },
            "type": "TEXT",
            "content": {
                "type": "TEXT",
                "text": "Hello, world!"
            },
            "createdAt": 1738426850000
        }
    },
    "timestamp": 1738426850100
}
```

#### 3. Emoji 表情 (EMOJI_SEND / EMOJI_RECEIVE)

**Client → Server: EMOJI_SEND**

```json
{
    "type": "EMOJI_SEND",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "senderId": "user_alice_1738426800000",
        "emoji": "👍"
    },
    "timestamp": 1738426860000
}
```

**Server → Client: EMOJI_RECEIVE** (发送给对方用户)

```json
{
    "type": "EMOJI_RECEIVE",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "senderId": "user_alice_1738426800000",
        "emoji": "👍"
    },
    "timestamp": 1738426860100
}
```

#### 4. 语音识别 (ASR_TEXT_PUSH / ASR_TEXT)

**Client → Server: ASR_TEXT_PUSH**

```json
{
    "type": "ASR_TEXT_PUSH",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "speakerId": "user_alice_1738426800000",
        "seq": 1,
        "text": "这是识别的文本",
        "isFinal": false
    },
    "timestamp": 1738426870000
}
```

**Server → Client: ASR_TEXT** (广播给对方用户)

```json
{
    "type": "ASR_TEXT",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "speakerId": "user_alice_1738426800000",
        "seq": 1,
        "text": "这是识别的文本",
        "isFinal": false
    },
    "timestamp": 1738426870100
}
```

**说明**:
- `seq`: 序列号，用于去重（客户端递增）
- `isFinal`: `false` 表示中间结果，`true` 表示最终结果
- 后端会进行去重（基于 seq）和节流（200ms）处理

#### 5. 震天鼓游戏

**5.1 Server → Client: DRUM_READY** (房间准备就绪)

```json
{
    "type": "DRUM_READY",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "serverTimeMs": 1738426900000,
        "hostRole": "Organizer",
        "organizerName": "Alice",
        "joinerName": "Bob"
    },
    "timestamp": 1738426900000
}
```

**5.2 Server → Client: DRUM_START** (游戏开始)

```json
{
    "type": "DRUM_START",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "startAtMs": 1738426903000
    },
    "timestamp": 1738426900100
}
```

**5.3 Client → Server: DRUM_TAP** (玩家点击)

```json
{
    "type": "DRUM_TAP",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "role": "Organizer",
        "delta": 5,
        "clientTimeMs": 1738426905000
    },
    "timestamp": 1738426905000
}
```

**5.4 Server → Client: DRUM_TAP** (广播对手点击)

```json
{
    "type": "DRUM_TAP",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "role": "Joiner",
        "delta": 3,
        "clientTimeMs": 1738426905100
    },
    "timestamp": 1738426905100
}
```

**5.5 Server → Client: DRUM_FINISH** (游戏结束)

```json
{
    "type": "DRUM_FINISH",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "endAtMs": 1738426913000
    },
    "timestamp": 1738426913000
}
```

**5.6 Server → Client: DRUM_RESULT** (最终结果)

```json
{
    "type": "DRUM_RESULT",
    "data": {
        "roomId": "room_A1B2C3_1738426800000",
        "organizerScore": 152,
        "joinerScore": 148,
        "winnerRole": "Organizer"
    },
    "timestamp": 1738426913100
}
```

**说明**:
- `role`: 玩家角色，`"Organizer"` (开房者) 或 `"Joiner"` (加入者)
- `delta`: 本次批量点击的次数
- 游戏时长固定为 10 秒

#### 6. 错误通知 (ERROR)

**Server → Client: ERROR**

```json
{
    "type": "ERROR",
    "data": {
        "code": "ROOM_NOT_FOUND",
        "message": "Room not found"
    },
    "timestamp": 1738426920000
}
```

**错误码列表**:

| 错误码 | 说明 |
|--------|------|
| `INVALID_PAYLOAD` | 消息格式错误 |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `ROOM_FULL` | 房间已满（2人） |
| `ROOM_CLOSED` | 房间已关闭 |
| `NOT_PARTICIPANT` | 不是房间成员 |
| `ROOM_NOT_READY` | 房间未准备好（需要2人） |
| `ALREADY_JOINED` | 已经加入房间 |
| `INTERNAL_ERROR` | 服务器内部错误 |

### 详细 API 文档

完整的 API 规格和使用示例请查看：
- 📡 [HTTP & WebSocket API 完整文档](docs/api-specification.md) - 所有接口的详细说明
- 🏠 [创建房间](docs/features/01-room-creation.md) - HTTP API 使用指南
- 🔌 [加入房间](docs/features/02-join-room.md) - WebSocket 协议详解
- 💬 [聊天消息](docs/features/03-chat-messaging.md) - 消息收发机制
- 🔑 [腾讯云 STS Token](docs/features/08-tencent-sts-token.md) - 获取临时凭证
- ⚠️ [错误处理](docs/features/05-error-handling.md) - 错误码参考

---

## 开发命令

```bash
# 开发模式（使用 ts-node 直接运行）
npm run dev

# 编译 TypeScript 到 dist/
npm run build

# 运行编译后的代码（生产模式）
npm start

# 代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# 代码格式化
npm run format

# 检查代码格式
npm run format:check

# WebSocket 测试脚本
npm run ws:test

# TypeScript 类型检查（不生成文件）
npx tsc --noEmit
```

---

## 🏗️ 项目架构

本项目采用**三层架构**设计：

```
Routes (路由) → Controllers (控制器) → Services (服务) → Repositories (仓储)
```

### 核心原则

- ✅ **职责分离**: 每层只负责自己的职责
- ✅ **单向依赖**: 上层依赖下层，下层不依赖上层
- ✅ **可测试性**: 每层可独立测试

### 详细架构文档

完整的架构设计和最佳实践请查看：
- 🏗️ [架构可视化文档](docs/architecture-visual.md) - 完整文件结构、数据流、分层职责
- 📊 [数据模型](docs/data-models.md) - Room, User, Message 等实体定义
- 📋 [产品需求](docs/product-requirements.md) - 功能需求和验收标准

---

## 🎤 ASR 语音识别架构

本项目采用**客户端直连架构**实现 ASR 功能：

```
┌─────────────┐                    ┌──────────────────┐
│   客户端 A   │◄──────WebSocket───►│   后端服务器      │
│  (发言者)    │                    │                  │
└─────────────┘                    │  - 去重 (seq)     │
       │                           │  - 节流 (200ms)   │
       │ 临时凭证                   │  - 广播           │
       ↓                           └──────────────────┘
┌─────────────┐                            │
│ 腾讯云 ASR   │                            │ ASR_TEXT
│  WebSocket  │                            ↓
└─────────────┘                    ┌─────────────┐
       │                            │   客户端 B   │
       │ 识别结果                    │  (听众)      │
       └──► 本地显示 + ASR_TEXT_PUSH ►└─────────────┘
```

### 工作流程

1. **客户端获取临时凭证**: `GET /v1/tencent/credentials`
2. **客户端直连腾讯云 ASR**: 使用临时凭证进行语音识别
3. **客户端推送识别结果**: 通过 `ASR_TEXT_PUSH` 发送给后端
4. **后端处理和广播**: 去重、节流后通过 `ASR_TEXT` 广播给其他参与者

### 优势

- ✅ **低延迟**: 客户端直连，无服务器中转
- ✅ **高可用**: 后端故障不影响语音识别
- ✅ **省带宽**: 音频数据不经过后端
- ✅ **安全**: 使用 STS 临时凭证，永久密钥不暴露

详细文档：[ASR 实时语音识别](docs/features/07-asr-real-time-speech.md)

---

## 更多信息

- 规范文档：[../.cursor/rules/04-websocket.md](../.cursor/rules/04-websocket.md)
- 后端 CLAUDE 指南：[CLAUDE.md](CLAUDE.md)

---

## License

ISC
