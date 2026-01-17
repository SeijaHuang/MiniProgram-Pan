## 后端服务说明

本目录为微信小程序项目的 **Node.js/TypeScript 后端服务**，提供 HTTP 接口和 WebSocket 实时通信能力，支持双人游戏互动功能。

## 核心功能

- **健康检查 API**：用于服务探活和监控
- **WebSocket 实时通信**：支持房间管理、玩家匹配、游戏状态同步
- **游戏房间管理**：创建/加入房间、玩家准备、实时对战
- **心跳检测**：自动清理断开连接的客户端
- **环境配置管理**：使用 dotenv 管理配置

## 技术栈

- **运行环境**：Node.js >= 14.0.0
- **语言**：TypeScript (严格模式)
- **HTTP 框架**：Express 5
- **WebSocket**：ws 8.x
- **代码规范**：ESLint + Prettier

## 项目结构

```
backend/
├── src/
│   ├── constants/          # 配置常量
│   │   └── config.ts       # 应用配置 (端口、WebSocket 配置等)
│   ├── models/             # 数据模型
│   │   ├── player.ts       # 玩家模型
│   │   └── game.ts         # 游戏房间模型
│   ├── services/           # 业务逻辑层
│   │   ├── game-room-manager.ts  # 房间管理服务
│   │   └── handlers/       # 消息处理器
│   │       ├── room-create-handler.ts
│   │       ├── room-join-handler.ts
│   │       ├── player-ready-handler.ts
│   │       └── game-move-handler.ts
│   ├── types/              # TypeScript 类型定义
│   │   ├── ws-messages.ts  # WebSocket 消息协议
│   │   └── common.ts       # 通用类型
│   ├── utils/              # 工具函数
│   │   ├── ws-client.ts    # WebSocket 客户端封装
│   │   ├── ws-utils.ts     # WebSocket 工具函数
│   │   ├── env-loader.ts   # 环境变量加载器
│   │   └── message-handler.ts  # 消息处理器基类
│   ├── middlewares/        # Express 中间件 (待实现)
│   ├── app.ts              # Express 应用实例
│   ├── ws.ts               # WebSocket 服务器
│   └── index.ts            # 应用入口
├── scripts/
│   └── ws-test.ts          # WebSocket 测试脚本
├── .env                    # 环境变量配置
├── .env.example            # 环境变量示例
├── tsconfig.json           # TypeScript 配置
└── package.json            # 项目依赖
```

## 快速开始

### 方式一：使用 Docker (推荐) ⭐

#### 前置要求
1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. **重要**: 启动 Docker Desktop 并等待完全启动

#### 一键启动（Windows）

双击运行 `start-docker.bat` 或：
```powershell
.\start-docker.bat
```

#### 或使用命令行

```bash
cd backend

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

**启动成功后会看到：**
```
✅ Backend is running!

📝 Service Info:
   HTTP:      http://localhost:8080
   WebSocket: ws://localhost:8080/ws
   Health:    http://localhost:8080/health

📊 View logs:  docker-compose logs -f
🛑 Stop:       docker-compose down
```

**验证服务：**
```bash
curl http://localhost:8080/health
# 返回: {"ok":true}
```

**使用 Postman 测试 WebSocket：**
1. 打开 Postman
2. New → WebSocket Request
3. URL: `ws://localhost:8080/ws`
4. Connect 后发送测试消息（见下方 WebSocket 测试部分）

> 💡 详细的 Docker 使用说明请查看 [DOCKER.md](./DOCKER.md)

### 方式二：本地开发

#### 1. 安装依赖

```bash
cd backend
npm install
```

#### 2. 配置环境变量

复制 `.env.example` 为 `.env`（首次运行已自动创建）：

```bash
cp .env.example .env
```

默认配置：
- `PORT=8080` - HTTP 服务端口
- `WS_PATH=/ws` - WebSocket 路径
- `WS_HEARTBEAT_INTERVAL=30000` - 心跳间隔 (30秒)
- `WS_CLIENT_TIMEOUT=60000` - 客户端超时 (60秒)

#### 3. 启动服务

```bash
npm run dev
```
启动成功后会看到：

```
Environment variables loaded successfully
WebSocket server initialized on path: /ws
Server listening on port 8080
Environment: development
```


#### 4. 验证服务

**HTTP 健康检查**：
```bash
curl http://localhost:8080/health
# 返回: {"ok":true}
```

或浏览器访问：`http://localhost:8080/health`

## WebSocket 测试

### 方法一：使用 Postman

1. **下载 Postman** (免费): https://www.postman.com/downloads/
2. 打开 Postman，创建新的 **WebSocket**
3. 连接地址：`ws://localhost:8080/ws`
4. 点击 **Connect**

**发送测试消息**：

#### 1. 创建房间
```json
{
  "type": "room:create",
  "data": {
    "playerName": "玩家1",
    "playerAvatar": "https://example.com/avatar.png"
  },
  "timestamp": 1737158400000
}
```

服务器会返回：
```json
{
  "type": "room:created",
  "data": {
    "room": {
      "id": "room_xxx",
      "state": "waiting",
      "players": [...]
    },
    "player": {
      "id": "player_xxx",
      "name": "玩家1"
    }
  },
  "timestamp": 1737158400000
}
```

#### 2. 加入房间
```json
{
  "type": "room:join",
  "data": {
    "roomId": "room_xxx",
    "playerName": "玩家2"
  },
  "timestamp": 1737158400000
}
```

#### 3. 玩家准备
```json
{
  "type": "player:ready",
  "data": {
    "playerId": "player_xxx"
  },
  "timestamp": 1737158400000
}
```

#### 4. 游戏移动
```json
{
  "type": "game:move",
  "data": {
    "x": 5,
    "y": 3
  },
  "timestamp": 1737158400000
}
```

#### 5. 心跳包
```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": 1737158400000
  },
  "timestamp": 1737158400000
}
```

### 方法二：使用 VS Code 扩展

1. 安装扩展：**WebSocket Client** 或 **REST Client**
2. 创建 `.http` 文件：

```http
### WebSocket Connection
CONNECT ws://localhost:8080/ws

{
  "type": "room:create",
  "data": {
    "playerName": "测试玩家"
  },
  "timestamp": {{$timestamp}}
}
```

### 方法三：使用浏览器 Console

打开浏览器开发者工具，在 Console 中执行：

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // 创建房间
  ws.send(JSON.stringify({
    type: 'room:create',
    data: {
      playerName: '浏览器测试'
    },
    timestamp: Date.now()
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

### 方法四：使用测试脚本

运行内置测试脚本：

```bash
npm run ws:test
```

## Docker 命令速查

### 基本命令

```bash
# 启动服务
docker-compose up

# 后台启动
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重新构建并启动
docker-compose up --build

# 进入容器
docker-compose exec backend sh

# 重启服务
docker-compose restart
```

### 高级命令

```bash
# 只构建镜像
docker-compose build

# 查看运行状态
docker-compose ps

# 停止并删除容器、网络
docker-compose down -v

# 使用生产 Dockerfile
docker build -t miniprogram-backend -f Dockerfile .
docker run -p 8080:8080 miniprogram-backend
```

## 可用的 npm 脚本

```bash
npm run dev          # 开发模式启动 (使用 ts-node)
npm run ws:test      # 运行 WebSocket 测试脚本
npm run lint         # ESLint 代码检查
npm run lint:fix     # 自动修复 ESLint 问题
npm run format       # Prettier 格式化代码
npm run format:check # 检查代码格式
```

## WebSocket 消息协议

### 消息类型 (MessageType)

| 类型 | 描述 | 方向 |
|------|------|------|
| `welcome` | 欢迎消息 | 服务器 → 客户端 |
| `heartbeat` | 心跳请求 | 客户端 → 服务器 |
| `heartbeat_ack` | 心跳响应 | 服务器 → 客户端 |
| `room:create` | 创建房间 | 客户端 → 服务器 |
| `room:created` | 房间已创建 | 服务器 → 客户端 |
| `room:join` | 加入房间 | 客户端 → 服务器 |
| `room:joined` | 已加入房间 | 服务器 → 客户端 |
| `player:joined` | 玩家加入通知 | 服务器 → 所有玩家 |
| `player:ready` | 玩家准备 | 客户端 → 服务器 |
| `game:start` | 游戏开始 | 服务器 → 所有玩家 |
| `game:move` | 游戏移动 | 客户端 → 服务器 |
| `game:update` | 游戏状态更新 | 服务器 → 所有玩家 |
| `game:end` | 游戏结束 | 服务器 → 所有玩家 |
| `player:disconnected` | 玩家断开 | 服务器 → 其他玩家 |
| `error` | 错误消息 | 服务器 → 客户端 |

### 消息格式

所有消息都遵循以下格式：

```typescript
{
  type: string;        // 消息类型
  data: object;        // 消息数据
  timestamp: number;   // 时间戳 (毫秒)
}
```

## 开发规范

### TypeScript 严格模式
- **禁止使用 `any` 类型** - ESLint 会报错
- 所有函数必须有显式返回类型
- 使用接口定义所有数据结构

### 架构原则
- **分层架构**：Controllers → Services → Models
- **单一职责**：每个模块只做一件事
- **依赖注入**：使用单例模式管理服务

### 代码风格
```bash
npm run lint       # 检查代码质量
npm run lint:fix   # 自动修复问题
npm run format     # 格式化代码
```

## 扩展开发

### 添加新的 WebSocket 消息类型

1. **定义消息类型** (`src/types/ws-messages.ts`):
```typescript
export enum MessageType {
  NEW_MESSAGE = 'new:message',
}

export interface INewMessage extends IBaseMessage<INewMessageData> {
  type: MessageType.NEW_MESSAGE;
}Docker 开发工作流

### 典型开发流程

1. **启动 Docker 服务**
   ```bash
   docker-compose up -d
   ```

2. **使用 Postman 测试**
   - 连接到 `ws://localhost:8080/ws`
   - 发送测试消息

3. **修改代码**
   - 修改 `src/` 下的文件
   - Docker 会自动检测文件变化并重启服务

4. **查看日志**
   ```bash
   docker-compose logs -f backend
   ```

5. **停止服务**
   ```bash
   docker-compose down
   ```

### 故障排查

#### 端口被占用
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <进程ID> /F

# 或修改 docker-compose.yml 中的端口映射
ports:
  - "8081:8080"  # 改为 8081
```

#### 容器无法启动
```bash
# 查看详细日志
docker-compose logs backend

# 重新构建镜像
docker-compose build --no-cache
docker-compose up
```

#### 代码修改未生效
```bash
# 重启容器
docker-compose restart

# 或重新构建
docker-compose up --build
```

## 部署

### Docker 生产部署

```bash
# 1. 构建生产镜像
docker build -t miniprogram-backend:latest .

# 2. 运行容器
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  --name miniprogram-backend \
  --restart unless-stopped \
  miniprogram-backend:latest

# 3. 查看日志
docker logs -f miniprogram-backend
```

### 其他部署方式

生产环境建议：
- 使用 Docker Compose 或 Kubernetes 编排
- 配置反向代理 (Nginx) 处理 WebSocket 升级
- 启用 WSS (安全 WebSocket) 协议
- 设置环境变量 `NODE_ENV=production`
- 使用 PM2 进程管理（非 Docker 环境）t, message: { data: INewMessageData }): Promise<void> {
    // 处理逻辑
  }
}
```

3. **注册处理器** (`src/ws.ts`):
```typescript
case MessageType.NEW_MESSAGE:
  await newMessageHandler.handle(client, message as never);
  break;
```

### 添加 HTTP 路由

在 `src/app.ts` 中添加：

```typescript
app.get('/api/rooms', (req, res) => {
  const rooms = gameRoomManager.getAvailableRooms();
  res.json({ rooms });
});
```

## 常见问题

### Q: 如何查看所有活跃的房间？
A: 可以通过 `gameRoomManager.getAllRooms()` 获取，或添加 HTTP API 接口。

### Q: 心跳包多久发送一次？
A: 默认 30 秒，可在 `.env` 中通过 `WS_HEARTBEAT_INTERVAL` 配置。

### Q: 客户端多久没响应会被断开？
A: 默认 60 秒，可在 `.env` 中通过 `WS_CLIENT_TIMEOUT` 配置。

### Q: 如何调试 WebSocket？
A: 使用 Postman 或浏览器开发者工具的 Network → WS 标签页查看消息。

## 部署

生产环境建议：
- 使用 PM2 或 Docker 部署
- 配置反向代理 (Nginx) 处理 WebSocket 升级
- 启用 WSS (安全 WebSocket) 协议
- 设置环境变量 `NODE_ENV=production`

## 许可证

MIT

