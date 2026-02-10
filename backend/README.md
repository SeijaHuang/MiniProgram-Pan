# 后端文档中心

双人聊天室后端服务 + 异步 LLM 判决系统。

## 技术栈

| 类别         | 技术                                           |
| ------------ | ---------------------------------------------- |
| Runtime      | Node.js 18+                                    |
| Language     | TypeScript 5+ (strict, no `any`)               |
| HTTP         | Express 5                                      |
| WebSocket    | ws library                                     |
| Database     | PostgreSQL + Prisma ORM                        |
| Validation   | Zod                                            |
| LLM          | OpenAI API (gpt-4o)                            |
| Architecture | Routes → Controllers → Services → Repositories |

## 特性

- 严格的双人房间系统（最多 2 人）
- HTTP 用于房间创建，WebSocket 用于实时通信
- 房间状态机：WAITING → READY → CLOSED
- 异步 LLM 判决：HTTP 创建任务，独立 Worker 进程执行
- 幂等任务创建 + 房间级互斥锁
- 完整的错误处理和 Zod 校验
- TypeScript 类型安全，三层架构职责分离

---

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

必需变量：

```env
# 服务器
PORT=8080
NODE_ENV=development
WS_PATH=/ws

# PostgreSQL（必需）
DATABASE_URL=postgresql://chatroom:chatroom_dev_pwd@localhost:5432/chatroom?schema=public

# OpenAI（Worker 必需）
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，兼容其他 API
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 创建数据库表（开发环境）
npx prisma migrate dev

# 或部署已有迁移（生产环境）
npx prisma migrate deploy
```

### 4. 启动服务

需要同时运行两个进程：

```bash
# 终端 1：API 服务器
npm run dev

# 终端 2：LLM Worker（判决任务处理）
npm run worker:llm
```

服务器: `http://localhost:8080`
WebSocket: `ws://localhost:8080/ws`

### 5. 验证

```bash
# 健康检查（含数据库连通性）
curl http://localhost:8080/health

# 创建房间
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'

# WebSocket 测试
npm run ws:test

# LLM 模块 E2E 自测（需要 API 服务器已启动）
npm run test:llm
```

---

## 开发命令

```bash
# --- API 服务器 ---
npm run dev              # 开发模式（ts-node，热重载）
npm run build            # 编译 TypeScript（含 prisma generate）
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

# --- 数据库 ---
npx prisma generate      # 生成 Prisma Client
npx prisma migrate dev   # 创建/应用迁移（开发）
npx prisma migrate deploy # 应用迁移（生产）
npx prisma studio        # 可视化数据库浏览

# --- 测试 ---
npm run ws:test          # WebSocket 连接测试
npm run test:llm         # LLM 模块 E2E 自测
```

---

## 项目结构

```
backend/
├── prisma/
│   └── schema.prisma           # 数据库模型（LlmTask, RoomLlmLock）
├── scripts/
│   └── test-llm-e2e.ts         # LLM E2E 自测脚本
└── src/
    ├── index.ts                # API 服务器入口
    ├── app.ts                  # Express 配置 + 路由挂载
    ├── ws.ts                   # WebSocket 服务器初始化
    ├── clients/
    │   └── openai.client.ts    # OpenAI 封装（仅 Worker 使用）
    ├── constants/
    │   └── config.ts           # 所有配置常量
    ├── controllers/
    │   ├── room-controller.ts          # 房间 HTTP
    │   ├── ws-controller.ts            # WebSocket 消息路由
    │   ├── llm-judgement.controller.ts # LLM 判决 HTTP
    │   └── tencent-controller.ts       # 腾讯云 STS
    ├── database/
    │   └── prisma.ts           # PrismaClient 单例
    ├── models/
    │   ├── entities/           # 领域实体（Room, User, Message）
    │   ├── schemas/            # Zod 校验 schema
    │   └── dto/                # 请求/响应 DTO
    ├── repositories/
    │   ├── llm-task.repository.ts      # LLM 任务数据访问
    │   └── room-llm-lock.repository.ts # 房间锁数据访问
    ├── routes/
    │   ├── room-routes.ts              # /room/*
    │   ├── llm-judgement.routes.ts     # /v1/rooms/:roomId/llm/*
    │   └── tencent-routes.ts           # /tencent/*
    ├── services/
    │   ├── core/
    │   │   └── llm-judgement.service.ts  # LLM 判决业务逻辑
    │   ├── websocket/
    │   │   ├── connection-manager.ts   # WS 连接管理
    │   │   ├── room-manager.ts         # 房间状态机（内存）
    │   │   └── drum-game-manager.ts    # 鼓点游戏状态
    │   └── handlers/                   # WS 消息处理器
    ├── types/
    │   ├── http/               # HTTP 类型 + 错误码
    │   ├── websocket/          # WS 消息类型
    │   └── llm/                # LLM 类型定义
    ├── utils/                  # 工具函数
    └── worker/
        ├── index.ts                    # Worker 入口（加载 .env）
        └── llm-judgement.worker.ts     # Worker 轮询主循环
```

---

## HTTP API

### 房间

| Method | Path                   | Description                |
| ------ | ---------------------- | -------------------------- |
| GET    | `/health`              | 健康检查（含数据库连通性） |
| POST   | `/room/create`         | 创建房间                   |
| GET    | `/tencent/credentials` | 腾讯云 STS 临时凭证        |

### LLM 判决（v1）

| Method | Path                              | Description          |
| ------ | --------------------------------- | -------------------- |
| POST   | `/v1/rooms/:roomId/llm/judgement` | 创建判决任务（幂等） |
| GET    | `/v1/llm/tasks/:taskId`           | 查询任务状态/结果    |

#### POST /v1/rooms/:roomId/llm/judgement

创建 LLM 判决任务。同一 `idempotencyKey` 多次调用返回相同 `taskId`。

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
        "taskId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "succeeded",
        "resultJson": {
            "verdict": "host",
            "reasons": ["..."],
            "suggestions": ["..."],
            "quotes": { "host": ["..."], "participant": ["..."] }
        },
        "errorMessage": null,
        "createdAt": "2026-02-10T12:00:00.000Z",
        "startedAt": "2026-02-10T12:00:01.000Z",
        "finishedAt": "2026-02-10T12:00:05.000Z"
    }
}
```

#### 错误响应

所有错误统一格式：

```json
{
    "success": false,
    "error": { "code": "ERROR_CODE", "message": "描述" }
}
```

| HTTP Status | Code                 | 场景           |
| ----------- | -------------------- | -------------- |
| 400         | `INVALID_REQUEST`    | 请求参数不合法 |
| 404         | `ROOM_NOT_FOUND`     | 房间不存在     |
| 404         | `TASK_NOT_FOUND`     | 任务不存在     |
| 500         | `TASK_CREATE_FAILED` | 创建任务异常   |
| 500         | `INTERNAL_ERROR`     | 服务器内部错误 |

---

## WebSocket 协议

连接地址: `ws://localhost:8080/ws`

### 房间流程

```
POST /room/create → roomCode
    ↓
WS JOIN_ROOM (roomCode) → JOIN_ACK
    ↓ (第二人加入)
READY → 3s 倒计时 → 鼓点游戏(10s) → 聊天室
```

### 消息类型

**Client → Server**: `JOIN_ROOM` | `DRUM_TAP` | `CHAT_SEND` | `ASR_TEXT_PUSH`

**Server → Client**: `JOIN_ACK` | `DRUM_READY` | `DRUM_START` | `DRUM_TAP` | `DRUM_FINISH` | `DRUM_RESULT` | `CHAT_RECEIVE` | `ASR_TEXT` | `ERROR`

消息格式: `{ "type": "MESSAGE_TYPE", "data": {...}, "timestamp": 1234567890 }`

---

## LLM 判决模块

### 架构

```
客户端 → POST 创建任务 → [llm_tasks 表: queued]
                                ↓
                    Worker 轮询 claimNextQueuedTask()
                                ↓
                    tryAcquireRoomLock() → 获得锁
                                ↓
                    OpenAI API → 解析 JSON 结果
                                ↓
                    markSucceeded() + releaseRoomLock()
                                ↓
客户端 ← GET 查询结果 ← [llm_tasks 表: succeeded]
```

### 任务状态流转

```
queued → running → succeeded
                 → failed
```

### 调用链

```
HTTP:   routes → controller → service → repository → PostgreSQL
Worker: pollLoop → repository.claim → openai.client → repository.markSucceeded
```

关键约束：

- **OpenAI 仅在 Worker 中调用**，HTTP 层不 import `openai.client.ts`
- **同一房间串行执行**，`room_llm_locks` 表保证互斥
- **幂等创建**，相同 `idempotencyKey` 返回已有任务

### 环境变量

```env
# Worker 调优（可选，均有默认值）
LLM_WORKER_POLL_INTERVAL_MS=500    # 轮询间隔（默认 500ms）
LLM_WORKER_LOCK_TIMEOUT_MS=60000   # 房间锁 TTL（默认 60s）
LLM_MAX_RETRIES=3                  # 最大重试（默认 3）
```

### 常见问题

| 问题                    | 排查                                    |
| ----------------------- | --------------------------------------- |
| 任务一直 queued         | Worker 是否在运行？`npm run worker:llm` |
| ROOM_LOCKED 失败        | 同房间有任务执行中，等待完成或锁过期    |
| OpenAI 超时             | 检查网络和 API Key，超时默认 60s        |
| 数据库连接失败          | 检查 `DATABASE_URL` 和 PostgreSQL 状态  |
| `OPENAI_API_KEY 未配置` | Worker 的 `.env` 中需要设置 API Key     |

---

## Docker 部署

### 快速启动

```bash
# 开发模式（热重载）
docker-compose up -d

# 生产构建
docker build -t chatroom-backend:latest -f Dockerfile .
docker run -d -p 8080:8080 -e NODE_ENV=production chatroom-backend:latest
```

### 常用命令

| 操作     | 命令                             |
| -------- | -------------------------------- |
| 启动     | `docker-compose up -d`           |
| 停止     | `docker-compose down`            |
| 日志     | `docker-compose logs -f`         |
| 重建     | `docker-compose up --build -d`   |
| 进入容器 | `docker-compose exec backend sh` |

### 故障排查

| 错误                              | 解决                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| `bind: address already in use`    | Windows: `netstat -ano \| findstr :8080` 然后 `taskkill /PID <PID> /F` |
| `Cannot connect to Docker daemon` | 启动 Docker Desktop 后重试                                             |
| 代码修改未生效                    | `docker-compose down && docker-compose up --build`                     |

---

## 详细文档

| 文档                                                 | 描述                           |
| ---------------------------------------------------- | ------------------------------ |
| [创建房间](docs/features/01-room-creation.md)        | HTTP API 创建房间流程          |
| [加入房间](docs/features/02-join-room.md)            | WebSocket 加入房间协议         |
| [聊天消息](docs/features/03-chat-messaging.md)       | 实时聊天消息收发               |
| [连接管理](docs/features/04-connection-lifecycle.md) | WebSocket 连接生命周期         |
| [错误处理](docs/features/05-error-handling.md)       | 错误码和处理机制               |
| [数据模型](docs/data-models.md)                      | Room, User, Message 等实体定义 |
| [架构可视化](docs/architecture-visual.md)            | 三层架构和文件结构             |
| [API 完整规格](docs/api-specification.md)            | 所有 API 详细说明              |

---

## License

ISC
