# 聊天室后端服务

基于HTTP + WebSocket的双人聊天室系统，支持房间创建、加入、实时聊天和击鼓游戏。

## 技术栈

- **Node.js** + **TypeScript**
- **Express** - HTTP服务器
- **WebSocket (ws)** - 实时通信
- **dotenv** - 环境变量管理

## 项目特点

- ✅ 严格的双人房间系统（最多2人）
- ✅ HTTP用于房间创建，WebSocket用于实时通信
- ✅ 房间状态机：WAITING → READY → CLOSED
- ✅ 击鼓游戏：双人实时对战，服务器计时计分
- ✅ 游戏状态机：WAITING → COUNTDOWN → RUNNING → FINISHED
- ✅ 完整的错误处理和验证
- ✅ TypeScript类型安全
- ✅ 三层架构设计，职责分离
- ✅ Repository模式，支持未来数据库集成

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

创建`.env`文件（或使用`.env.example`）：

```env
PORT=8080
WS_PATH=/ws
NODE_ENV=development
```

### 3. 启动服务器

#### 开发模式（推荐用于开发调试）

```bash
npm run dev
```

使用 `ts-node` 直接运行 TypeScript 代码，支持热重载。

#### 生产模式

**第一步：编译 TypeScript**

```bash
npm run build
```

这将编译 TypeScript 代码到 `dist/` 目录。

**第二步：运行编译后的代码**

```bash
npm start
```

或者直接运行：

```bash
node dist/index.js
```

服务器将在 `http://localhost:8080` 启动，WebSocket路径为 `ws://localhost:8080/ws`

### 4. 验证服务器运行

**测试 HTTP API：**

```bash
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'
```

**测试 WebSocket：**

使用提供的测试脚本：

```bash
npm run ws:test
```

---

## Docker 部署

### 前置要求

- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- 确保 Docker Desktop 正在运行

### 快速启动

#### Windows 用户

双击运行 `start-docker.bat` 或在 PowerShell 中执行：

```powershell
.\start-docker.bat
```

#### Mac/Linux 用户

```bash
chmod +x start-docker.sh
./start-docker.sh
```

#### 使用 docker-compose 命令

**1. 构建 Docker 镜像**

```bash
docker-compose build
```

**2. 启动容器（开发模式，支持热重载）**

```bash
docker-compose up -d
```

**3. 查看日志**

```bash
# 查看所有日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f backend
```

**4. 停止服务**

```bash
docker-compose down
```

### Docker 常用命令

| 操作 | 命令 |
|------|------|
| 构建镜像 | `docker-compose build` |
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 查看日志 | `docker-compose logs -f` |
| 重启服务 | `docker-compose restart` |
| 重新构建并启动 | `docker-compose up --build -d` |
| 进入容器 | `docker-compose exec backend sh` |
| 查看容器状态 | `docker-compose ps` |

### Docker 环境说明

**开发环境（默认）**
- 使用 `Dockerfile.dev`
- 支持代码热重载
- 包含所有开发依赖
- 源代码通过 volume 挂载

**生产环境**
- 使用 `Dockerfile`
- 多阶段构建，优化镜像大小
- 只包含生产依赖
- 运行编译后的代码

切换到生产环境：修改 `docker-compose.yml` 中的 `dockerfile: Dockerfile`

### 验证 Docker 部署

```bash
# 测试 HTTP API
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'

# 查看容器状态
docker-compose ps
```

详细的 Docker 部署文档请查看 [DOCKER.md](DOCKER.md)

---

## API文档

### HTTP API

#### POST /room/create
创建新房间

**请求体：**
```json
{
  "creator": {
    "userId": "user_alice",
    "nickname": "Alice"
  }
}
```

**成功响应（201）：**
```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "room_abc123...",
      "roomCode": "123456",
      "participants": [
        {
          "user": {
            "userId": "user_alice",
            "nickname": "Alice"
          },
          "joinedAt": 1234567890000
        }
      ],
      "status": "WAITING",
      "createdAt": 1234567890000
    }
  }
}
```

**错误响应（400/500）：**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "creator.userId and creator.nickname are required"
  }
}
```

---

### WebSocket协议

连接URL: `ws://localhost:8080/ws`

#### 消息格式

所有消息都包含：
```typescript
{
  "type": "MESSAGE_TYPE",
  "data": { /* 消息数据 */ },
  "timestamp": 1234567890000
}
```

---

### 客户端 → 服务器消息

#### 1. JOIN_ROOM - 加入房间

```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "123456",
    "user": {
      "userId": "user_bob",
      "nickname": "Bob"
    }
  },
  "timestamp": 1234567890000
}
```

**验证规则：**
1. ✅ roomCode、user.userId、user.nickname必填
2. ✅ 房间必须存在
3. ✅ 房间状态必须是WAITING
4. ✅ 房间未满（< 2人）
5. ✅ 用户未加入该房间

---

#### 2. CHAT_SEND - 发送消息

```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hello!"
    }
  },
  "timestamp": 1234567890000
}
```

**前置条件：**
- 必须已通过JOIN_ROOM加入房间
- 房间状态必须是READY（2人）

---

### 服务器 → 客户端消息

#### 1. JOIN_ACK - 加入确认

当用户成功加入或房间状态变化时，**所有参与者**都会收到：

```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomId": "room_abc123...",
      "roomCode": "123456",
      "participants": [
        {
          "user": { "userId": "user_alice", "nickname": "Alice" },
          "joinedAt": 1234567890000
        },
        {
          "user": { "userId": "user_bob", "nickname": "Bob" },
          "joinedAt": 1234567891000
        }
      ],
      "status": "READY",
      "createdAt": 1234567890000
    }
  },
  "timestamp": 1234567891000
}
```

---

#### 2. CHAT_RECEIVE - 接收消息

所有参与者都会收到广播：

```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "messageId": "msg_xyz789...",
      "roomId": "room_abc123...",
      "sender": {
        "userId": "user_alice",
        "nickname": "Alice"
      },
      "type": "TEXT",
      "content": {
        "type": "TEXT",
        "text": "Hello!"
      },
      "createdAt": 1234567892000
    }
  },
  "timestamp": 1234567892000
}
```

---

#### 3. ERROR - 错误消息

```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND",
    "message": "ROOM_NOT_FOUND"
  },
  "timestamp": 1234567890000
}
```

**错误码：**
- `INVALID_PAYLOAD` - 无效的消息格式
- `ROOM_NOT_FOUND` - 房间不存在
- `ROOM_FULL` - 房间已满
- `ROOM_CLOSED` - 房间已关闭
- `NOT_PARTICIPANT` - 不是房间参与者
- `ROOM_NOT_READY` - 房间未就绪（需要2人才能聊天/游戏未运行）
- `ALREADY_JOINED` - 已加入该房间
- `INTERNAL_ERROR` - 服务器内部错误

---

### 击鼓游戏协议 (Drum Game)

房间就绪（2人加入）后自动启动击鼓游戏。

#### 游戏流程

```
房间 READY (2人)
    ↓ 自动启动
DRUM_READY (服务器 → 客户端)
    ↓
DRUM_START (服务器 → 客户端, 含开始时间)
    ↓ 3秒倒计时
游戏开始 (RUNNING)
    ↓ 10秒游戏时间
    ↓ DRUM_TAP 双向传输
DRUM_FINISH (服务器 → 客户端)
    ↓
DRUM_RESULT (服务器 → 客户端, 含最终结果)
```

#### 游戏配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `COUNTDOWN_MS` | 3000ms | 倒计时时长 |
| `GAME_DURATION_MS` | 10000ms | 游戏时长 |

#### 玩家角色 (EPlayerRole)

| 角色 | 值 | 说明 |
|------|-----|------|
| Organizer | `"Organizer"` | 房间创建者（房主） |
| Joiner | `"Joiner"` | 加入者 |

#### 游戏阶段 (EGamePhase)

| 阶段 | 值 | 说明 |
|------|-----|------|
| Waiting | `"WAITING"` | 等待玩家 |
| Countdown | `"COUNTDOWN"` | 倒计时中 |
| Running | `"RUNNING"` | 游戏进行中 |
| Finished | `"FINISHED"` | 游戏结束 |

---

#### 4. DRUM_READY - 游戏就绪

房间满员后服务器自动发送，通知双方游戏即将开始。

**服务器 → 客户端：**
```json
{
  "type": "DRUM_READY",
  "data": {
    "roomId": "room_abc123...",
    "serverTimeMs": 1234567890000,
    "hostRole": "Organizer",
    "organizerName": "Alice",
    "joinerName": "Bob"
  },
  "timestamp": 1234567890000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | string | 房间ID |
| `serverTimeMs` | number | 服务器当前时间戳 |
| `hostRole` | string | 房主角色（固定为 "Organizer"） |
| `organizerName` | string | Organizer 昵称 |
| `joinerName` | string | Joiner 昵称 |

---

#### 5. DRUM_START - 游戏开始信号

通知客户端游戏开始的精确时间。

**服务器 → 客户端：**
```json
{
  "type": "DRUM_START",
  "data": {
    "roomId": "room_abc123...",
    "startAtMs": 1234567893000
  },
  "timestamp": 1234567890000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | string | 房间ID |
| `startAtMs` | number | 游戏开始的绝对时间戳（倒计时结束后） |

---

#### 6. DRUM_TAP - 点击事件

玩家点击时发送，服务器转发给对手。

**客户端 → 服务器：**
```json
{
  "type": "DRUM_TAP",
  "data": {
    "roomId": "room_abc123...",
    "role": "Organizer",
    "delta": 5,
    "clientTimeMs": 1234567895000
  },
  "timestamp": 1234567895000
}
```

**服务器 → 对手（转发）：**
```json
{
  "type": "DRUM_TAP",
  "data": {
    "roomId": "room_abc123...",
    "role": "Organizer",
    "delta": 5,
    "clientTimeMs": 1234567895000
  },
  "timestamp": 1234567895000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | string | 房间ID |
| `role` | string | 发送者角色 |
| `delta` | number | 本次批量点击数（正整数） |
| `clientTimeMs` | number | 客户端时间戳 |

**注意：**
- 点击消息只转发给对手，不回发给自己
- 服务器累计计分，客户端可用于显示对手进度

---

#### 7. DRUM_FINISH - 游戏结束信号

游戏时间到，通知双方停止点击。

**服务器 → 客户端：**
```json
{
  "type": "DRUM_FINISH",
  "data": {
    "roomId": "room_abc123...",
    "endAtMs": 1234567903000
  },
  "timestamp": 1234567903000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | string | 房间ID |
| `endAtMs` | number | 游戏结束的绝对时间戳 |

---

#### 8. DRUM_RESULT - 游戏结果

最终结果，包含双方得分和胜者。

**服务器 → 客户端：**
```json
{
  "type": "DRUM_RESULT",
  "data": {
    "roomId": "room_abc123...",
    "organizerScore": 42,
    "joinerScore": 38,
    "winnerRole": "Organizer"
  },
  "timestamp": 1234567903000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | string | 房间ID |
| `organizerScore` | number | Organizer 得分 |
| `joinerScore` | number | Joiner 得分 |
| `winnerRole` | string | 胜者角色 |

**胜负判定规则：**
- 得分高者获胜
- 平局时房主（Organizer）获胜

---

## 使用Postman测试

### 准备工作

1. 确保服务器已启动（`npm run dev`）
2. 打开Postman

### 完整测试流程

> **⚠️ 重要说明**：
> 1. 创建房间时，creator会在**领域模型**中成为第一个参与者
> 2. 但creator仍需通过**JOIN_ROOM**建立WebSocket连接才能收发消息
> 3. JOIN_ROOM对于creator来说是"连接到已加入的房间"，不会重复添加

#### 步骤1: Alice创建房间（HTTP）

**请求：**
- Method: `POST`
- URL: `http://localhost:8080/room/create`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "creator": {
    "userId": "user_alice",
    "nickname": "Alice"
  }
}
```

**预期响应：**
- Status: `201 Created`
- 记下响应中的 `roomCode`（例如："123456"）
- ✅ Alice在领域模型中成为第一个参与者，状态为`WAITING`

---

#### 步骤2: Alice建立WebSocket连接

**在Postman中：**
1. 新建 `WebSocket Request`
2. URL: `ws://localhost:8080/ws`
3. 点击 `Connect`

连接成功后保持此连接打开（命名为"Alice连接"）

---

#### 步骤3: Alice发送JOIN_ROOM绑定连接

**在Alice连接中发送：**
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "123456",
    "user": {
      "userId": "user_alice",
      "nickname": "Alice"
    }
  },
  "timestamp": 1234567890000
}
```

**预期接收：**
```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomCode": "123456",
      "participants": [ /* 1个参与者: Alice */ ],
      "status": "WAITING"
    }
  }
}
```

✅ Alice的WebSocket现已绑定到房间，可以接收消息了！

---

#### 步骤4: Bob建立WebSocket连接
1. 新建另一个 `WebSocket Request`
2. URL: `ws://localhost:8080/ws`
3. 点击 `Connect`

保持此连接打开（命名为"Bob连接"）

---

**在Bob连接中发送：**
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomCode": "123456",
    "user": {
      "userId": "user_bob",
      "nickname": "Bob"
    }
  },
  "timestamp": 1234567891000
}
```

**预期：Alice和Bob都会收到：**
```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "roomCode": "123456",
      "participants": [ /* 2个参与者: Alice, Bob */ ],
      "status": "READY"
    }
  }
}
```

房间状态变为`READY`，现在可以聊天了！🎉

---

#### 步骤6: Alice发送消息（WebSocket）
```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hi Bob! 👋"
    }
  },
  "timestamp": 1234567892000
}
```

**预期：Alice和Bob都会收到：**
```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "sender": {
        "userId": "user_alice",
        "nickname": "Alice"
      },
      "content": {
        "type": "TEXT",
        "text": "Hi Bob! 👋"
      }
    }
  }
}
```

---

**在Bob连接中发送：**
```json
{
  "type": "CHAT_SEND",
  "data": {
    "content": {
      "type": "TEXT",
      "text": "Hello Alice! How are you?"
    }
  },
  "timestamp": 1234567893000
}
```

**预期：Alice和Bob都会收到：**
```json
{
  "type": "CHAT_RECEIVE",
  "data": {
    "message": {
      "sender": {
        "userId": "user_bob",
        "nickname": "Bob"
      },
      "content": {
        "type": "TEXT",
        "text": "Hello Alice! How are you?"
      }
    }
  }
}
```

---

#### 步骤8: 测试断开连接

```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "participants": [ /* 只剩Alice */ ]
    }
  }
}
```

如果Alice也断开，房间将被关闭并删除。

---

## 测试场景

### ✅ 正常流程
1. 创建房间 → WAITING (1人)
2.# 🔄 替代测试流程（两个独立用户）

如果你想测试两个完全独立的用户都通过JOIN_ROOM加入：

1. **Charlie创建房间（HTTP）**
2. **Alice建立WebSocket → 发送JOIN_ROOM加入**
3. **Bob建立WebSocket → 发送JOIN_ROOM加入**
4. **Alice和Bob聊天**

这种方式下，Charlie只是创建了房间但没有建立WebSocket连接，Alice和Bob是实际的参与者。

---

## 测试场景

### ✅ 正常流程
1. 创建房间 → creator自动成为第一个参与者 (WAITING)
2. 第二人通过WebSocket JOIN_ROOM错误场景测试

#### 测试1: 房间满了
尝试第三个用户加入同一房间，会收到：
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_FULL"
  }
}
```

#### 测试2: 在WAITING状态发消息
只有1人时尝试发送消息，会收到：
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_READY",
    "message": "Room is not ready for chat (need 2 participants)"
  }
}
```

#### 测试4: Creator绑定连接
Creator创建房间后，使用JOIN_ROOM绑定WebSocket连接（不会报错）：
```json
{
  "type": "JOIN_ACK",
  "data": {
    "room": {
      "status": "WAITING",
      "participants": [ /* creator */ ]
    }
  }
}
```

✅ 这是正常行为，用于绑定WebSocket连接

#### 测试3: 错误的roomCode
使用不存在的roomCode加入，会收到：
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND"
  }
}
```

---

## 房间状态机

```
CREATE (HTTP)
     ↓
  WAITING (1人)
     ↓ 第二人JOIN
  READY (2人) ← 可以聊天，自动启动游戏
     ↓ 有人离开
  CLOSED (删除)
```

## 游戏状态机

```
房间 READY
     ↓ 自动初始化
  WAITING (游戏初始化)
     ↓ 发送 DRUM_READY, DRUM_START
  COUNTDOWN (3秒倒计时)
     ↓ 倒计时结束
  RUNNING (10秒游戏) ← 接收 DRUM_TAP
     ↓ 游戏时间到
  FINISHED ← 发送 DRUM_FINISH, DRUM_RESULT
     ↓
  清理游戏状态
```

---

## 开发命令

## 可用脚本命令

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

## 架构设计

### 三层架构 (Three-Tier Architecture)

本项目采用清晰的三层架构设计，将路由、控制器、业务逻辑和数据访问完全分离。

```
┌─────────────────────────────────────────────┐
│         Presentation Layer                  │
│  Routes → Controllers                       │
│  - HTTP 路由定义                            │
│  - WebSocket 消息路由                       │
│  - 请求/响应格式化                          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│        Business Logic Layer                 │
│  Services                                   │
│  - 核心业务逻辑                             │
│  - 业务规则验证                             │
│  - 流程编排                                 │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│       Data Access Layer                     │
│  Repositories (未来支持)                    │
│  - 数据库操作封装                           │
│  - CRUD 抽象                                │
└─────────────────────────────────────────────┘
```

### 核心设计原则

#### 1. 职责分离 (Separation of Concerns)
- **Routes**: 只定义URL路径和HTTP方法
- **Controllers**: 只处理请求/响应，不包含业务逻辑
- **Services**: 只处理业务逻辑，不直接发送响应
- **Repositories**: 只负责数据访问（未来）

#### 2. 依赖方向
```
Routes → Controllers → Services → Repositories
```

高层模块不依赖低层模块细节，都依赖抽象接口。

#### 3. 可测试性
每层可独立测试，无需Mock整个技术栈：
- Services 可以不依赖 HTTP/WebSocket 测试
- Controllers 可以Mock Services 测试
- Routes 通过集成测试验证

### 项目结构

```
backend/
├── src/
│   ├── routes/                      # 🔵 路由层
│   │   └── room-routes.ts           # 房间路由定义
│   │
│   ├── controllers/                 # 🟢 控制器层
│   │   ├── room-controller.ts       # HTTP 请求处理
│   │   └── ws-controller.ts         # WebSocket 消息路由
│   │
│   ├── services/                    # 🟡 服务层
│   │   ├── core/                    # 核心业务服务
│   │   │   └── room/
│   │   │       ├── room.service.ts       # 房间业务逻辑
│   │   │       └── room-crud.service.ts  # 房间 CRUD (未来)
│   │   ├── websocket/               # WebSocket 专用服务
│   │   │   ├── connection-manager.ts    # 连接管理
│   │   │   ├── room-manager.ts          # 房间管理
│   │   │   └── drum-game-manager.ts     # 击鼓游戏状态管理
│   │   └── handlers/                # 业务逻辑处理器
│   │       ├── join-room-handler.ts
│   │       ├── chat-send-handler.ts
│   │       └── drum-tap-handler.ts      # 击鼓点击处理
│   │
│   ├── repositories/                # 🟣 数据访问层 (预留)
│   │   └── base/
│   │       └── base.repository.interface.ts
│   │
│   ├── models/                      # 数据模型
│   │   ├── entities/                # 数据库实体
│   │   │   ├── room.ts
│   │   │   ├── user.ts
│   │   │   └── message.ts
│   │   ├── schemas/                 # Zod 验证模式
│   │   │   ├── ws-message.schema.ts     # WebSocket 消息验证
│   │   │   └── drum-message.schema.ts   # 击鼓消息验证
│   │   ├── dto/                     # 数据传输对象
│   │   │   ├── request/
│   │   │   └── response/
│   │   ├── interfaces/              # TypeScript 接口
│   │   └── enums/                   # 枚举类型
│   │
│   ├── middlewares/                 # 中间件
│   │   ├── validation/              # 请求验证
│   │   ├── error/                   # 错误处理
│   │   └── logging/                 # 日志记录
│   │
│   ├── database/                    # 数据库配置 (预留)
│   │   ├── config/
│   │   ├── migrations/
│   │   └── schemas/
│   │
│   ├── types/                       # 类型定义
│   │   ├── http.ts                  # HTTP 相关类型
│   │   ├── websocket/               # WebSocket 消息类型
│   │   │   ├── base.ts              # 基础类型 (EWSMessageType, EPlayerRole)
│   │   │   ├── join-room.ts         # 加入房间消息
│   │   │   ├── chat.ts              # 聊天消息
│   │   │   ├── error.ts             # 错误消息
│   │   │   ├── drum.ts              # 击鼓游戏消息 (EGamePhase)
│   │   │   └── index.ts             # 统一导出
│   │   └── common.ts                # 通用类型
│   │
│   ├── constants/                   # 常量
│   │   └── config.ts                # APP_CONFIG, WS_CONFIG, ROOM_CONFIG, DRUM_CONFIG
│   │
│   ├── utils/                       # 工具函数
│   │   ├── validators/              # 验证函数
│   │   ├── formatters/              # 格式化函数
│   │   └── helpers/                 # 辅助函数
│   │
│   ├── config/                      # 配置文件
│   │   ├── app.config.ts
│   │   └── websocket.config.ts
│   │
│   ├── app.ts                       # Express 应用配置
│   ├── ws.ts                        # WebSocket 应用配置
│   └── index.ts                     # 应用入口
│
├── tests/                           # 测试目录
│   ├── unit/                        # 单元测试
│   ├── integration/                 # 集成测试
│   └── e2e/                         # 端到端测试
│
├── .env                             # 环境变量
├── package.json
├── tsconfig.json
└── README.md
```

### 数据流向示例

#### HTTP 请求：创建房间

```
用户请求
    ↓
POST /room/create (routes/room-routes.ts)
    ↓
RoomController.createRoom (controllers/room-controller.ts)
    ↓ 验证请求
    ↓ 调用服务
RoomService.createRoom (services/core/room/room.service.ts)
    ↓ 业务逻辑
    ↓ 调用仓储 (未来)
RoomRepository.create (repositories/room/room.repository.ts)
    ↓
数据库 (未来)
    ↓
返回结果 ← 格式化响应 ← Controller ← Service ← Repository
```

#### WebSocket 消息：加入房间

```
客户端消息 JOIN_ROOM
    ↓
WebSocket 连接 (ws.ts)
    ↓
WebSocketController.handleMessage (controllers/ws-controller.ts)
    ↓ 解析消息类型
    ↓ 路由到 Handler
handleJoinRoom (services/handlers/join-room-handler.ts)
    ↓ 验证业务规则
    ↓ 返回结果 (不发送响应)
WebSocketController
    ↓ 格式化 JOIN_ACK
    ↓ 广播给所有参与者
所有客户端 ← JOIN_ACK
    ↓ 如果房间 READY
WebSocketController.startDrumGame
    ↓ 初始化游戏状态
DrumGameManager.initGame
    ↓ 广播 DRUM_READY, DRUM_START
    ↓ 定时器调度游戏流程
```

#### WebSocket 消息：击鼓点击

```
客户端消息 DRUM_TAP
    ↓
WebSocketController.handleMessage (controllers/ws-controller.ts)
    ↓ 路由到 Handler
handleDrumTap (services/handlers/drum-tap-handler.ts)
    ↓ Zod 验证消息
    ↓ 检查游戏状态 (必须是 RUNNING)
DrumGameManager.recordTap
    ↓ 累计分数
    ↓ 返回结果
WebSocketController
    ↓ 转发给对手 (broadcastToRoomExcept)
对手客户端 ← DRUM_TAP
```

### 关键特性

#### ✅ 业务逻辑与传输协议分离
```typescript
// ❌ 错误：业务逻辑直接发送响应
function handleJoinRoom(...) {
    connectionManager.sendToConnection(...);  // 耦合！
}

// ✅ 正确：业务逻辑返回结果
function handleJoinRoom(...): Result {
    return { success: true, room };  // Controller 处理响应
}
```

#### ✅ Controller 不包含业务逻辑
```typescript
// ✅ Controller 只处理请求/响应
export class RoomController {
    static createRoom(req, res) {
        const room = roomService.createRoom();  // 调用 Service
        res.json({ success: true, data: { room } });  // 格式化响应
    }
}
```

#### ✅ Service 可复用
```typescript
// 同一个业务逻辑可用于不同协议
// HTTP
app.post('/room/join', (req, res) => {
    const result = roomService.joinRoom(...);  // 复用
    res.json(result);
});

// WebSocket
ws.on('message', (msg) => {
    const result = roomService.joinRoom(...);  // 复用
    ws.send(result);
});
```

### 未来扩展计划

#### 1. 数据持久化
- [ ] 添加 MongoDB/PostgreSQL 支持
- [ ] 实现 Repository 层
- [ ] 数据库迁移和种子数据

#### 2. 认证授权
- [ ] JWT 认证中间件
- [ ] 用户权限管理
- [ ] WebSocket 连接验证

#### 3. 缓存层
- [ ] Redis 集成
- [ ] 房间状态缓存
- [ ] 消息队列

#### 4. 测试覆盖
- [ ] 单元测试 (Services, Handlers)
- [ ] 集成测试 (API, WebSocket)
- [ ] E2E 测试

### 架构文档

详细的架构设计和最佳实践请参阅：
- [MODULAR-ARCHITECTURE.md](MODULAR-ARCHITECTURE.md) - 模块化架构详解
- [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md) - 架构快速参考
- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统架构概览

---

---

## 常见问题

### Q: 为什么房间只能2个人？
A: 这是设计规范，符合双人聊天室的定位。

### Q: 消息会持久化吗？
A: 当前版本不持久化，断开连接后消息丢失。

### Q: 可以创建多个房间吗？
A: 可以！每次调用`POST /room/create`都会创建新房间，通过不同的roomCode区分。

### Q: roomCode是如何生成的？
A: 自动生成6位数字，确保唯一性。

---

## 更多信息

- 规范文档：[../.cursor/rules/06-create-room-and-chat.md](../.cursor/rules/06-create-room-and-chat.md)

---

## License

ISC
