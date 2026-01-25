# Backend Architecture

本文档描述后端服务的整体架构设计和组织结构。

## 目录结构

```
backend/src/
├── index.ts                    # 应用入口，初始化 HTTP 和 WebSocket 服务器
├── app.ts                      # Express 应用配置，注册路由和中间件
├── ws.ts                       # WebSocket 服务器初始化，处理连接生命周期
├── constants/                  # 配置常量
│   └── config.ts               # 集中配置管理
├── controllers/                # 请求/响应处理层
│   ├── room-controller.ts      # HTTP 房间操作
│   └── ws-controller.ts        # WebSocket 消息路由和响应格式化
├── database/                   # 数据库配置 (占位)
│   └── config/
│       └── mongodb.config.ts   # MongoDB 配置
├── middlewares/                # 中间件
│   ├── error/
│   │   └── error-handler.middleware.ts    # 统一错误处理
│   ├── logging/
│   │   └── request-logger.middleware.ts   # 请求日志
│   └── validation/
│       └── validation.middleware.ts       # 通用验证中间件
├── models/                     # 数据模型
│   ├── dto/                    # 数据传输对象
│   │   ├── request/            # 请求 DTO
│   │   └── response/           # 响应 DTO
│   ├── entities/               # 领域实体
│   └── schemas/                # Zod 验证模式
├── repositories/               # 数据访问层 (占位)
│   ├── base/
│   └── room/
├── routes/                     # HTTP 路由定义
│   └── room-routes.ts
├── services/                   # 业务逻辑层
│   ├── core/                   # 核心业务服务
│   │   └── room/
│   ├── handlers/               # 业务逻辑处理器
│   └── websocket/              # WebSocket 相关服务
├── types/                      # TypeScript 类型定义
│   ├── common.ts               # 通用类型
│   ├── http/                   # HTTP 相关类型
│   └── websocket/              # WebSocket 相关类型
└── utils/                      # 工具函数
    └── env-loader.ts           # 环境变量加载
```

## 架构模式

### 三层架构

```
Routes → Controllers → Services → Repositories
   ↓          ↓            ↓           ↓
 路由定义   请求处理     业务逻辑    数据访问
```

### 各层职责

| 层级 | 职责 | 示例 |
|------|------|------|
| **Routes** | URL 路径定义 | `POST /room/create` |
| **Controllers** | 请求/响应格式化 | 验证输入、格式化输出 |
| **Services** | 业务逻辑 | 创建房间、加入房间 |
| **Repositories** | 数据访问抽象 | CRUD 操作 |

### 关键设计原则

1. **关注点分离**
   - 路由只负责 URL 路径定义
   - 控制器只负责请求/响应处理
   - 服务层处理业务逻辑
   - 仓库层处理数据访问

2. **协议无关性**
   - 业务逻辑可在 HTTP/WebSocket 间复用
   - 领域服务不依赖具体传输协议

3. **控制器无业务逻辑**
   - 控制器调用处理器/服务
   - 处理器返回结果，控制器格式化响应

## 入口文件

### index.ts

应用主入口，负责：
- 创建 HTTP 服务器
- 初始化 WebSocket 服务器
- 启动监听

```typescript
// 简化示例
import { createServer } from 'http';
import app from './app';
import { initializeWebSocket } from './ws';

const server = createServer(app);
initializeWebSocket(server);
server.listen(PORT);
```

### app.ts

Express 应用配置：
- 注册中间件 (CORS, JSON 解析, 日志)
- 注册路由
- 注册错误处理

### ws.ts

WebSocket 服务器初始化：
- 创建 WebSocket 服务器
- 处理连接事件
- 路由消息到对应处理器

## 单例模式

### RoomManager

管理所有房间的单例：

```typescript
class RoomManager {
    private static instance: RoomManager;
    private rooms: Map<string, IRoom>;

    static getInstance(): RoomManager {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }
}
```

### ConnectionManager

管理所有 WebSocket 连接的单例：

```typescript
class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Map<string, WebSocket>;

    static getInstance(): ConnectionManager {
        if (!this.instance) {
            this.instance = new ConnectionManager();
        }
        return this.instance;
    }
}
```

## 处理器模式

业务逻辑处理器返回结果，不直接发送响应：

```typescript
// handlers/join-room-handler.ts
export function handleJoinRoom(
    payload: IJoinRoomPayload,
    connectionId: string
): IJoinRoomResult {
    // 验证前置条件
    // 调用 RoomManager
    // 返回结果
    return { success: true, room };
}
```

控制器根据处理器结果格式化响应：

```typescript
// controllers/ws-controller.ts
const result = handleJoinRoom(payload, connectionId);
if (result.success) {
    broadcastToRoom(formatJoinAck(result.room));
} else {
    sendError(result.error);
}
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 14.0.0 | 运行时 |
| Express | ^5.2.1 | HTTP 服务器 |
| ws | ^8.19.0 | WebSocket 服务器 |
| Zod | ^4.3.5 | 运行时验证 |
| TypeScript | ^5.9.3 | 类型安全 |
| dotenv | ^17.2.3 | 环境变量 |

## 当前限制

- **内存存储**: 房间数据存储在内存中，服务器重启后丢失
- **无认证**: 未实现用户认证/授权
- **无持久化**: 消息历史不持久化
- **无限流**: 未实现请求限流

## 未来扩展

- Repository 接口已准备好数据库集成
- MongoDB 配置结构已就绪
- 中间件结构已准备好认证扩展
- 服务层已准备好缓存/事件扩展
