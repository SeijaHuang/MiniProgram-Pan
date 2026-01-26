# 申冤后端服务

基于 HTTP + WebSocket 的双人聊天室系统，支持房间创建、加入、实时聊天和击鼓游戏。

## 技术栈

- **Node.js** + **TypeScript**
- **Express** - HTTP 服务器
- **WebSocket (ws)** - 实时通信
- **Zod** - 消息验证
- **dotenv** - 环境变量

## 特性

- 严格的双人房间系统 (最多 2 人)
- HTTP 用于房间创建，WebSocket 用于实时通信
- 房间状态机: WAITING → READY → CLOSED
- 击鼓游戏: 双人实时对战，服务器计时计分
- 游戏状态机: WAITING → COUNTDOWN → RUNNING → FINISHED
- 三层架构设计，职责分离
- TypeScript 类型安全

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件:

```env
PORT=8080
WS_PATH=/ws
NODE_ENV=development
```

### 3. 启动服务器

```bash
# 开发模式 (推荐)
npm run dev

# 生产模式
npm run build && npm start
```

服务器: `http://localhost:8080`
WebSocket: `ws://localhost:8080/ws`

### 4. 验证运行

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

### WebSocket 协议

连接: `ws://localhost:8080/ws`

#### 消息格式

```typescript
{
  "type": "MESSAGE_TYPE",
  "data": { ... },
  "timestamp": 1234567890000
}
```

#### 客户端 → 服务器

| 消息类型 | 说明 |
|----------|------|
| `JOIN_ROOM` | 加入房间 |
| `CHAT_SEND` | 发送聊天消息 |
| `DRUM_TAP` | 击鼓点击 |

#### 服务器 → 客户端

| 消息类型 | 说明 |
|----------|------|
| `JOIN_ACK` | 加入确认 |
| `CHAT_RECEIVE` | 接收聊天消息 |
| `DRUM_READY` | 游戏就绪 |
| `DRUM_START` | 游戏开始 (含开始时间) |
| `DRUM_TAP` | 对手点击 (转发) |
| `DRUM_FINISH` | 游戏结束 |
| `DRUM_RESULT` | 游戏结果 |
| `ERROR` | 错误消息 |

### 击鼓游戏流程

```
房间 READY (2人)
    ↓ 自动启动
DRUM_READY (服务器通知)
    ↓
DRUM_START (含开始时间)
    ↓ 3秒倒计时
游戏开始 (RUNNING)
    ↓ 10秒游戏时间
    ↓ DRUM_TAP 双向传输
DRUM_FINISH
    ↓
DRUM_RESULT (最终结果)
```

**游戏配置**:
- 倒计时: 3000ms
- 游戏时长: 10000ms
- 胜负规则: 分数高者胜，平局房主胜

**玩家角色**:
- `Organizer`: 房间创建者
- `Joiner`: 加入者

### 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_PAYLOAD` | 无效的消息格式 |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `ROOM_FULL` | 房间已满 |
| `ROOM_CLOSED` | 房间已关闭 |
| `NOT_PARTICIPANT` | 不是房间参与者 |
| `ROOM_NOT_READY` | 房间未就绪 |
| `ALREADY_JOINED` | 已加入该房间 |
| `INTERNAL_ERROR` | 服务器内部错误 |

## 开发命令

```bash
npm run dev          # 开发模式 (ts-node)
npm run build        # 编译 TypeScript
npm start            # 生产模式
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复
npm run format       # 格式化代码
npm run ws:test      # WebSocket 测试
```

## Docker 部署

### 快速启动

```bash
# Windows
.\start-docker.bat

# Mac/Linux
chmod +x start-docker.sh && ./start-docker.sh

# 或使用 docker-compose
docker-compose up -d
```

### 常用命令

| 操作 | 命令 |
|------|------|
| 构建镜像 | `docker-compose build` |
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 查看日志 | `docker-compose logs -f` |
| 重启服务 | `docker-compose restart` |

## 架构设计

### 三层架构

```
Presentation Layer (Routes → Controllers)
         ↓
Business Logic Layer (Services, Handlers)
         ↓
Data Access Layer (Repositories - 预留)
```

### 核心设计原则

- **职责分离**: Routes 定义路由，Controllers 处理请求，Services 处理业务
- **依赖方向**: Routes → Controllers → Services → Repositories
- **可测试性**: 各层独立测试

### 数据流向

**HTTP 创建房间**:
```
POST /room/create → RoomController → RoomService → 返回结果
```

**WebSocket 加入房间**:
```
JOIN_ROOM → WSController → JoinRoomHandler → 广播 JOIN_ACK
    ↓ 房间 READY
启动游戏 → DrumGameManager → 广播 DRUM_READY, DRUM_START
```

**WebSocket 击鼓点击**:
```
DRUM_TAP → WSController → DrumTapHandler → DrumGameManager
    ↓
转发给对手 (broadcastToRoomExcept)
```

## 状态机

### 房间状态

```
CREATE (HTTP)
     ↓
  WAITING (1人)
     ↓ 第二人 JOIN
  READY (2人) ← 可聊天，自动启动游戏
     ↓ 有人离开
  CLOSED (删除)
```

### 游戏状态

```
房间 READY
     ↓
  WAITING (初始化)
     ↓ DRUM_READY, DRUM_START
  COUNTDOWN (3秒)
     ↓
  RUNNING (10秒) ← 接收 DRUM_TAP
     ↓
  FINISHED ← DRUM_FINISH, DRUM_RESULT
```

## 文档

详细文档请查看 `docs/backend/`:

- [架构设计](../docs/backend/architecture.md)
- [HTTP API](../docs/backend/api.md)
- [WebSocket 协议](../docs/backend/websocket.md)
- [数据模型](../docs/backend/models.md)
- [服务层](../docs/backend/services.md)
- [配置管理](../docs/backend/configuration.md)
- [中间件](../docs/backend/middleware.md)

## 许可证

ISC
