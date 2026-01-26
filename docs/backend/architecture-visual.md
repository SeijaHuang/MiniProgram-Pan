# 后端三层架构可视化

## 当前完整文件结构

```
backend/src/
│
├── 📁 routes/                           # 🔵 路由层 (Route Layer)
│   ├── index.ts                         # (预留) 路由聚合
│   └── room-routes.ts                   # ✅ 房间路由
│
├── 📁 controllers/                      # 🟢 控制器层 (Controller Layer)
│   ├── room-controller.ts               # ✅ HTTP 房间控制器
│   └── ws-controller.ts                 # ✅ WebSocket 控制器
│
├── 📁 services/                         # 🟡 服务层 (Service Layer)
│   ├── 📁 core/                         # ✅ 核心业务服务
│   │   └── 📁 room/
│   │       ├── room.service.ts          # ✅ 房间业务逻辑
│   │       └── room-crud.service.ts     # ✅ 房间 CRUD (预留)
│   ├── 📁 websocket/                    # ✅ WebSocket 服务
│   │   ├── connection-manager.ts        # ✅ 连接管理
│   │   └── room-manager.ts             # ✅ 房间管理
│   └── 📁 handlers/                     # ✅ 业务处理器
│       ├── join-room-handler.ts         # ✅ 加入房间处理
│       └── chat-send-handler.ts         # ✅ 发送消息处理
│
├── 📁 repositories/                     # 🟣 数据访问层 (Repository Layer)
│   ├── 📁 base/                         # ✅ 基础仓储
│   │   └── base.repository.interface.ts # ✅ CRUD 接口
│   └── 📁 room/                         # ✅ 房间仓储
│       └── room.repository.interface.ts # ✅ 房间接口
│
├── 📁 models/                           # 📊 数据模型层 (Model Layer)
│   ├── 📁 entities/                     # ✅ 数据库实体
│   │   ├── room.ts                      # ✅ 房间实体
│   │   ├── user.ts                      # ✅ 用户实体
│   │   └── message.ts                   # ✅ 消息实体
│   ├── 📁 dto/                          # ✅ 数据传输对象
│   │   ├── 📁 request/                  # ✅ 请求 DTO
│   │   │   ├── create-room.dto.ts       # ✅
│   │   │   ├── join-room.dto.ts         # ✅
│   │   │   └── send-message.dto.ts      # ✅
│   │   └── 📁 response/                 # ✅ 响应 DTO
│   │       ├── room.response.dto.ts     # ✅
│   │       ├── user.response.dto.ts     # ✅
│   │       └── message.response.dto.ts  # ✅
│   ├── 📁 interfaces/                   # (预留) TypeScript 接口
│   └── 📁 enums/                        # (预留) 枚举类型
│
├── 📁 database/                         # 🗄️ 数据库层 (Database Layer)
│   ├── 📁 config/                       # ✅ 数据库配置
│   │   ├── database.config.ts           # ✅ 数据库选择
│   │   ├── mongodb.config.ts            # ✅ MongoDB 配置
│   │   └── postgresql.config.ts         # ✅ PostgreSQL 配置
│   ├── 📁 migrations/                   # (预留) 迁移脚本
│   ├── 📁 seeders/                      # (预留) 种子数据
│   └── 📁 schemas/                      # (预留) 数据库模式
│
├── 📁 middlewares/                      # 🔧 中间件层 (Middleware Layer)
│   ├── 📁 validation/                   # ✅ 验证中间件
│   │   └── validation.middleware.ts     # ✅
│   ├── 📁 error/                        # ✅ 错误处理
│   │   └── error-handler.middleware.ts  # ✅
│   ├── 📁 logging/                      # ✅ 日志记录
│   │   └── request-logger.middleware.ts # ✅
│   └── 📁 auth/                         # (预留) 认证授权
│
├── 📁 types/                            # 📝 类型定义 (Type Definitions)
│   ├── http.ts                          # ✅ HTTP 类型
│   ├── ws-messages.ts                   # ✅ WebSocket 消息
│   └── common.ts                        # ✅ 通用类型
│
├── 📁 constants/                        # 🔢 常量 (Constants)
│   └── config.ts                        # ✅ 配置常量
│
├── 📁 utils/                            # 🛠️ 工具函数 (Utilities)
│   ├── env-loader.ts                    # ✅ 环境变量
│   ├── 📁 validators/                   # (预留) 验证工具
│   ├── 📁 formatters/                   # (预留) 格式化工具
│   └── 📁 helpers/                      # (预留) 辅助函数
│
├── 📁 config/                           # ⚙️ 配置文件 (Configuration)
│   └── (预留) app.config.ts, etc.
│
├── app.ts                               # ✅ Express 应用
├── ws.ts                                # ✅ WebSocket 应用
└── index.ts                             # ✅ 入口文件
```

## 数据流可视化

### HTTP 请求流：创建房间

```
┌─────────────────────────────────────────────────────────┐
│                     用户请求                             │
│            POST /room/create                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🔵 ROUTE LAYER                                         │
│  routes/room-routes.ts                                  │
│  - 定义 URL 路径                                         │
│  - 映射到 Controller                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟢 CONTROLLER LAYER                                    │
│  controllers/room-controller.ts                         │
│  - 验证请求格式                                          │
│  - 调用 Service                                         │
│  - 格式化响应                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 SERVICE LAYER (Business Logic)                     │
│  services/core/room/room.service.ts                    │
│  - 业务逻辑编排                                          │
│  - 调用 RoomManager                                     │
│  - 缓存处理 (未来)                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 DOMAIN SERVICE                                      │
│  services/websocket/room-manager.ts                    │
│  - 房间领域逻辑                                          │
│  - 状态管理                                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟣 REPOSITORY LAYER (未来)                             │
│  repositories/room/room.repository.ts                  │
│  - 数据库 CRUD                                          │
│  - 数据持久化                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🗄️ DATABASE (未来)                                     │
│  MongoDB / PostgreSQL / In-Memory                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (返回路径)
                  Response
```

### WebSocket 消息流：加入房间

```
┌─────────────────────────────────────────────────────────┐
│                 客户端 WebSocket                         │
│              JOIN_ROOM { roomCode, user }               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  WebSocket Server (ws.ts)                               │
│  - 接收消息                                              │
│  - 委托给 Controller                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟢 WEBSOCKET CONTROLLER                                │
│  controllers/ws-controller.ts                           │
│  - 解析消息类型                                          │
│  - 路由到 Handler                                       │
│  - 格式化响应                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 BUSINESS LOGIC HANDLER                              │
│  services/handlers/join-room-handler.ts                │
│  - 验证业务规则                                          │
│  - 调用 Domain Service                                  │
│  - 返回结果 (不发送!)                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 DOMAIN SERVICES                                     │
│  ├─ room-manager.ts (加入房间)                          │
│  └─ connection-manager.ts (绑定连接)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (返回到 Controller)
┌─────────────────────────────────────────────────────────┐
│  🟢 CONTROLLER 格式化并广播                              │
│  connectionManager.broadcastToRoom(...)                │
│  - 创建 JOIN_ACK 消息                                   │
│  - 发送给所有参与者                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│             所有参与者收到 JOIN_ACK                      │
└─────────────────────────────────────────────────────────┘
```

## 分层职责表

| 层级 | 目录 | 职责 | 禁止 |
|------|------|------|------|
| **路由层** | `routes/` | URL 定义，映射到 Controller | ❌ 业务逻辑 |
| **控制器层** | `controllers/` | 请求/响应处理，调用 Service | ❌ 业务逻辑 |
| **服务层** | `services/core/` | 业务逻辑编排，流程协调 | ❌ 数据库操作 |
| **处理器层** | `services/handlers/` | 业务规则验证，返回结果 | ❌ 发送响应 |
| **领域服务** | `services/websocket/` | 领域逻辑，状态管理 | ❌ HTTP/WS 协议 |
| **仓储层** | `repositories/` | 数据访问，CRUD 抽象 | ❌ 业务逻辑 |
| **数据库层** | `database/` | 连接配置，迁移管理 | ❌ 业务逻辑 |
| **模型层** | `models/entities/` | 数据结构定义 | ❌ 任何逻辑 |
| **DTO层** | `models/dto/` | 传输对象，类型安全 | ❌ 任何逻辑 |

## 依赖方向图

```
Routes
  ↓
Controllers
  ↓
Services/Handlers
  ↓
Domain Services
  ↓
Repositories (未来)
  ↓
Database (未来)
```

**严格规则**:
- ⬆️ 上层可以依赖下层
- ⬇️ 下层不能依赖上层
- ↔️ 同层之间避免循环依赖

## 模块间通信

### ✅ 正确的通信方式

```typescript
// Controller → Service
const room = roomService.createRoom();

// Service → Domain Service
const room = roomManager.createRoom();

// Handler → Domain Service
const result = roomManager.joinRoom(...);
return { success: true, room: result.room };

// Domain Service → Repository (未来)
const room = await roomRepository.create(...);
```

### ❌ 错误的通信方式

```typescript
// ❌ Controller 直接访问 Repository
const room = await roomRepository.create(...);  // 跳过了 Service 层

// ❌ Handler 直接发送响应
connectionManager.sendToConnection(...);  // 应该返回结果给 Controller

// ❌ Repository 包含业务逻辑
async create(room) {
    if (room.participants.length > 2) throw ...  // 业务逻辑应该在 Service
    return db.save(room);
}
```

## 扩展路径

### 添加新功能：离开房间

```
1. 定义 Entity (已有: room.ts)
   
2. 定义 DTO
   ├─ models/dto/request/leave-room.dto.ts
   └─ models/dto/response/leave-room.response.dto.ts
   
3. 定义 Repository Interface
   └─ repositories/room/room.repository.interface.ts
      (添加 leaveRoom 方法)
   
4. 创建 Handler
   └─ services/handlers/leave-room-handler.ts
   
5. 更新 Controller
   └─ controllers/ws-controller.ts
      (添加 handleLeaveRoomMessage)
   
6. 更新 Domain Service
   └─ services/websocket/room-manager.ts
      (添加 leaveRoom 方法)
```

## 图例说明

- 🔵 **路由层**: URL 定义和映射
- 🟢 **控制器层**: 请求/响应处理
- 🟡 **服务层**: 业务逻辑和编排
- 🟣 **仓储层**: 数据访问抽象
- 🗄️ **数据库层**: 持久化存储
- 📊 **模型层**: 数据结构定义
- 🔧 **中间件层**: 横切关注点
- 📝 **类型层**: TypeScript 类型
- ⚙️ **配置层**: 应用配置

---

## 总结

✅ **三层架构已完整实现**
- 清晰的职责分离
- 标准化的数据流
- 为数据库集成做好准备
- 易于测试和维护


