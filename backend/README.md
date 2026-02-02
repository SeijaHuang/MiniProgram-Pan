# 后端文档中心

双人聊天室后端服务完整文档与使用指南。

## 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+
- **HTTP Framework**: Express
- **WebSocket**: ws library
- **Validation**: Zod
- **Architecture**: Controller → Service → Repository

## 特性

- ✅ 严格的双人房间系统（最多2人）
- ✅ HTTP用于房间创建，WebSocket用于实时通信
- ✅ 房间状态机：WAITING → READY → CLOSED
- ✅ 完整的错误处理和验证
- ✅ TypeScript类型安全
- ✅ 三层架构设计，职责分离
- ✅ Repository模式，支持未来数据库集成

---

## 📚 完整文档导航

### 功能特性文档

按功能模块划分的详细实现文档：

| 文档 | 描述 | 路径 |
|------|------|------|
| 🏠 [创建房间](docs/features/01-room-creation.md) | HTTP API 创建房间流程 | `POST /room/create` |
| 🔌 [加入房间](docs/features/02-join-room.md) | WebSocket 加入房间协议 | `JOIN_ROOM` 消息 |
| 💬 [聊天消息](docs/features/03-chat-messaging.md) | 实时聊天消息收发 | `CHAT_SEND/RECEIVE` |
| 🔗 [连接管理](docs/features/04-connection-lifecycle.md) | WebSocket 连接生命周期 | 连接/断开处理 |
| ⚠️ [错误处理](docs/features/05-error-handling.md) | 统一错误码和处理机制 | 错误响应规范 |
| 🥁 [震天鼓游戏](docs/features/06-drum-game.md) | 击鼓游戏机制 | `DRUM_TAP` 消息 |
| 🎤 [ASR 语音识别](docs/features/07-asr-real-time-speech.md) | 实时语音转文字 | `ASR_*` 消息 |
| 🔑 [腾讯云 STS Token](docs/features/08-tencent-sts-token.md) | 获取临时安全凭证 | `GET /tencent/credentials` |

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
WS_PATH=/ws
NODE_ENV=development

# 腾讯云配置（用于 ASR 语音识别服务）
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
TENCENT_REGION=ap-guangzhou
```

**注意**: 如果需要使用 ASR（语音识别）功能，必须配置腾讯云相关环境变量。

### 3. 启动服务器

```bash
# 开发模式 (推荐)
npm run dev

# 生产模式
npm run build && npm start
```

服务器: `http://localhost:8080`
WebSocket: `ws://localhost:8080/ws`

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

**测试腾讯云 STS Token：**

```bash
curl http://localhost:8080/tencent/credentials
```

---

## 🐳 Docker 部署

### 前置要求

- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- 确保 Docker Desktop 正在运行

### Docker 镜像说明

**Dockerfile.dev - 开发环境**
- 包含所有依赖（含devDependencies）
- 支持热重载
- 挂载源代码目录
- 使用`ts-node`直接运行TypeScript

**Dockerfile - 生产环境**
- 多阶段构建，优化镜像大小
- 只包含生产依赖
- TypeScript编译为JavaScript
- 使用编译后的`dist`目录运行

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

```bash
# 构建并启动（开发模式，支持热重载）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建
docker-compose up --build -d
```

### Docker 常用命令

| 操作 | 命令 |
|------|------|
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 查看日志 | `docker-compose logs -f` |
| 实时日志 | `docker-compose logs -f backend` |
| 重启服务 | `docker-compose restart` |
| 重新构建 | `docker-compose up --build` |
| 进入容器 | `docker-compose exec backend sh` |
| 查看状态 | `docker-compose ps` |

### 环境变量配置

在 `docker-compose.yml` 中配置：

```yaml
environment:
  - PORT=8080              # HTTP服务器端口
  - NODE_ENV=development   # 环境：development/production
  - WS_PATH=/ws           # WebSocket路径
  - LOG_LEVEL=debug       # 日志级别
```

### 生产部署

**方法1: 使用生产Dockerfile**

```bash
# 构建镜像
docker build -t chatroom-backend:latest -f Dockerfile .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  --name chatroom-backend \
  --restart unless-stopped \
  chatroom-backend:latest
```

**方法2: Docker Compose生产配置**

修改 `docker-compose.yml` 中的 `dockerfile: Dockerfile`，然后：

```bash
docker-compose -f docker-compose.yml up -d
```

### 故障排查

#### 问题1: 端口被占用

**错误**: `bind: address already in use`

**解决** (Windows):
```powershell
# 查找占用端口的进程
netstat -ano | findstr :8080

# 终止进程
taskkill /PID <PID> /F
```

**解决** (Mac/Linux):
```bash
# 查找并终止占用端口的进程
lsof -ti:8080 | xargs kill -9
```

#### 问题2: Docker Desktop 未启动

**错误**: `Cannot connect to the Docker daemon`

**解决**: 启动 Docker Desktop，等待完全启动后重试

#### 问题3: 代码修改未生效

```bash
# 重启容器
docker-compose restart

# 或完全重建
docker-compose down
docker-compose up --build
```

### 验证部署

```bash
# 测试 HTTP API
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test","nickname":"Test"}}'

# 测试 WebSocket
npm run ws:test
```

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
│       └── drum-tap-handler.ts
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

#### POST /room/create

创建新房间。

**请求**:
```json
{
  "creator": {
    "userId": "user_alice",
    "nickname": "Alice"
  }
}
```

**响应** (201):
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

#### GET /tencent/credentials

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
- HTTP: 创建房间 `POST /room/create`
- HTTP: 获取腾讯云 STS Token `GET /tencent/credentials`
- WebSocket: 加入房间、实时聊天、语音识别 `ws://localhost:8080/ws`

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

## 更多信息

- 规范文档：[../.cursor/rules/04-websocket.md](../.cursor/rules/04-websocket.md)

---

## License

ISC
