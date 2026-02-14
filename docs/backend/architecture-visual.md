# 后端三层架构可视化

## 当前完整文件结构

```
backend/src/
│
├── 📁 routes/                           # 🔵 路由层 (Route Layer)
│   ├── room-routes.ts                   # ✅ 房间路由 (POST /v1/rooms)
│   ├── llm-judgement.routes.ts          # ✅ LLM 判决路由 (POST /v1/rooms/:roomId/judgments)
│   └── tencent-routes.ts               # ✅ 腾讯云路由 (GET /v1/tencent/credentials)
│
├── 📁 controllers/                      # 🟢 控制器层 (Controller Layer)
│   ├── room-controller.ts               # ✅ HTTP 房间控制器
│   ├── llm-judgement.controller.ts      # ✅ LLM 判决控制器
│   ├── tencent-controller.ts            # ✅ 腾讯云 STS 控制器
│   └── ws-controller.ts                 # ✅ WebSocket 控制器（消息路由 + 游戏编排）
│
├── 📁 services/                         # 🟡 服务层 (Service Layer)
│   ├── 📁 core/                         # ✅ 核心业务服务
│   │   ├── 📁 room/
│   │   │   ├── room.service.ts          # ✅ 房间业务逻辑
│   │   │   └── room-crud.service.ts     # ✅ 房间 CRUD (预留)
│   │   └── llm-judgement.service.ts     # ✅ LLM 判决服务
│   ├── 📁 websocket/                    # ✅ WebSocket 领域服务
│   │   ├── connection-manager.ts        # ✅ 连接管理（路由 + 广播）
│   │   ├── room-manager.ts              # ✅ 房间状态管理
│   │   └── drum-game-manager.ts         # ✅ 震天鼓游戏状态管理
│   └── 📁 handlers/                     # ✅ 业务处理器（纯函数）
│       ├── join-room-handler.ts         # ✅ 加入房间处理
│       ├── chat-send-handler.ts         # ✅ 发送消息处理
│       ├── drum-tap-handler.ts          # ✅ 鼓点点击处理
│       ├── asr-text-handler.ts          # ✅ ASR 文本推送处理（去重 + 节流）
│       └── emoji-text-handler.ts        # ✅ 表情消息处理
│
├── 📁 clients/                          # 🌐 外部服务客户端
│   └── openai.client.ts                 # ✅ OpenAI API 客户端（判决生成）
│
├── 📁 models/                           # 📊 数据模型层 (Model Layer)
│   ├── 📁 entities/                     # ✅ 实体定义
│   │   ├── room.ts                      # ✅ 房间实体
│   │   ├── user.ts                      # ✅ 用户实体
│   │   └── message.ts                   # ✅ 消息实体
│   ├── 📁 dto/                          # ✅ 数据传输对象
│   │   ├── 📁 request/                  # ✅ 请求 DTO
│   │   └── 📁 response/                 # ✅ 响应 DTO
│   └── 📁 schemas/                      # ✅ Zod 验证模式
│       ├── http-request.schema.ts       # ✅ HTTP 请求验证
│       ├── llm-request.schema.ts        # ✅ LLM 请求验证
│       ├── ws-message.schema.ts         # ✅ WebSocket 消息验证
│       ├── drum-message.schema.ts       # ✅ 鼓点消息验证
│       ├── ws-asr-text-push.schema.ts   # ✅ ASR 文本推送验证
│       └── emoji-message.schema.ts      # ✅ 表情消息验证
│
├── 📁 types/                            # 📝 类型定义 (Type Definitions)
│   ├── 📁 http/                         # ✅ HTTP 类型
│   │   ├── base.ts                      # ✅ 基础类型（EHttpErrorCode, IBaseResponse）
│   │   ├── room.ts                      # ✅ 房间请求/响应类型
│   │   └── index.ts                     # ✅ 导出聚合
│   ├── 📁 websocket/                    # ✅ WebSocket 消息类型
│   │   ├── base.ts                      # ✅ 基础类型（EWSMessageType, EPlayerRole, IWSMessage）
│   │   ├── join-room.ts                 # ✅ 加入房间消息类型
│   │   ├── chat.ts                      # ✅ 聊天消息类型
│   │   ├── drum.ts                      # ✅ 震天鼓消息类型（EGamePhase, IDrumGameState）
│   │   ├── asr.ts                       # ✅ ASR 消息类型
│   │   ├── emoji.ts                     # ✅ 表情消息类型
│   │   ├── error.ts                     # ✅ 错误消息类型（EWSErrorCode）
│   │   └── index.ts                     # ✅ 导出聚合
│   ├── 📁 llm/                          # ✅ LLM 类型
│   │   ├── judgment.ts                  # ✅ 判决相关类型
│   │   └── index.ts                     # ✅ 导出聚合
│   └── common.ts                        # ✅ 通用类型
│
├── 📁 constants/                        # 🔢 常量 (Constants)
│   ├── config.ts                        # ✅ 配置常量（APP/WS/ROOM/DRUM/OPENAI/TENCENT）
│   └── prompts.ts                       # ✅ LLM Prompt 模板
│
├── 📁 utils/                            # 🛠️ 工具函数 (Utilities)
│   └── env-loader.ts                    # ✅ 环境变量加载
│
├── 📁 middlewares/                      # 🔧 中间件层 (预留)
│
├── app.ts                               # ✅ Express 应用（路由注册）
├── ws.ts                                # ✅ WebSocket 服务器初始化
└── index.ts                             # ✅ 入口文件（HTTP + WS 启动）
```

## 数据流可视化

### HTTP 请求流

**三条 HTTP 路由**:
- `POST /v1/rooms` → RoomController → RoomService → RoomManager
- `POST /v1/rooms/:roomId/judgments` → LlmJudgementController → LlmJudgementService → OpenAI Client
- `GET /v1/tencent/credentials` → TencentController → Tencent STS SDK

```
┌─────────────────────────────────────────────────────────┐
│                     用户请求                             │
│  POST /v1/rooms | POST .../judgments | GET .../credentials │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🔵 ROUTE LAYER                                         │
│  routes/room-routes.ts                                  │
│  routes/llm-judgement.routes.ts                         │
│  routes/tencent-routes.ts                               │
│  - 定义 URL 路径                                         │
│  - 映射到 Controller                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟢 CONTROLLER LAYER                                    │
│  controllers/room-controller.ts                         │
│  controllers/llm-judgement.controller.ts                │
│  controllers/tencent-controller.ts                      │
│  - 验证请求格式（Zod Schema）                             │
│  - 调用 Service                                         │
│  - 格式化响应                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 SERVICE LAYER (Business Logic)                     │
│  services/core/room/room.service.ts      → 房间创建     │
│  services/core/llm-judgement.service.ts  → LLM 判决     │
│  - 业务逻辑编排                                          │
│  - 调用 Domain Service / 外部客户端                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 DOMAIN SERVICE / 🌐 EXTERNAL CLIENT                │
│  services/websocket/room-manager.ts  → 房间领域逻辑     │
│  clients/openai.client.ts            → OpenAI API 调用  │
│  Tencent STS SDK                     → 临时凭证获取     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (返回路径)
                  Response
```

### WebSocket 消息流

**消息路由表** (ws-controller.ts):

| 客户端消息 | Handler | Domain Service | 响应消息 | 广播范围 |
|-----------|---------|---------------|---------|---------|
| `JOIN_ROOM` | join-room-handler | room-manager, connection-manager | `JOIN_ACK` | 全部参与者 |
| `CHAT_SEND` | chat-send-handler | connection-manager | `CHAT_RECEIVE` | 全部参与者 |
| `DRUM_TAP` | drum-tap-handler | drum-game-manager | `DRUM_TAP` | 仅对方 |
| `ASR_TEXT_PUSH` | asr-text-handler | connection-manager | `ASR_TEXT` | 仅对方 |
| `EMOJI_SEND` | emoji-text-handler | connection-manager | `EMOJI_RECEIVE` | 仅对方 |

```
┌─────────────────────────────────────────────────────────┐
│                 客户端 WebSocket                         │
│  JOIN_ROOM / CHAT_SEND / DRUM_TAP / ASR_TEXT_PUSH /    │
│  EMOJI_SEND                                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  WebSocket Server (ws.ts)                               │
│  - 接收消息，分配 connectionId                            │
│  - 委托给 Controller                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟢 WEBSOCKET CONTROLLER                                │
│  controllers/ws-controller.ts                           │
│  - 解析消息类型 (switch on message.type)                  │
│  - 路由到对应 Handler                                    │
│  - 编排震天鼓游戏定时流程                                 │
│  - 格式化响应并广播                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 BUSINESS LOGIC HANDLERS (纯函数)                    │
│  ├─ join-room-handler.ts    (加入房间)                  │
│  ├─ chat-send-handler.ts    (发送消息)                  │
│  ├─ drum-tap-handler.ts     (鼓点点击)                  │
│  ├─ asr-text-handler.ts     (ASR 文本去重 + 节流)       │
│  └─ emoji-text-handler.ts   (表情转发)                  │
│  - 验证业务规则，调用 Domain Service                     │
│  - 返回结果 (不发送!)                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  🟡 DOMAIN SERVICES (单例)                               │
│  ├─ room-manager.ts       (房间状态管理)                 │
│  ├─ connection-manager.ts (连接绑定 + 消息路由)          │
│  └─ drum-game-manager.ts  (游戏状态 + 计分)             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (返回到 Controller)
┌─────────────────────────────────────────────────────────┐
│  🟢 CONTROLLER 格式化并广播                              │
│  connectionManager.broadcastToRoom(...)                │
│  connectionManager.broadcastToRoomExcept(...)          │
│  connectionManager.sendToConnection(...)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│             参与者收到响应消息                            │
└─────────────────────────────────────────────────────────┘
```

### 震天鼓游戏编排流程

ws-controller.ts 同时负责游戏定时编排：

```
房间满员 (2人 JOIN_ACK)
   ↓ setTimeout(3000ms)
DRUM_READY → 广播给所有参与者
   ↓ (同时)
DRUM_START → 广播 startAtMs = Date.now() + 3000
   ↓ setTimeout(3000ms) → 游戏阶段: RUNNING
   ↓ setTimeout(10000ms)
DRUM_FINISH → 广播 endAtMs
   ↓ (立即)
DRUM_RESULT → 广播 organizerScore, joinerScore, winnerRole
   ↓
cleanupGame(roomId)
```

## 分层职责表

| 层级 | 目录 | 职责 | 禁止 |
|------|------|------|------|
| **路由层** | `routes/` | URL 定义，映射到 Controller | ❌ 业务逻辑 |
| **控制器层** | `controllers/` | 请求/响应处理，调用 Service | ❌ 业务逻辑 |
| **服务层** | `services/core/` | 业务逻辑编排，流程协调 | ❌ 数据库操作 |
| **处理器层** | `services/handlers/` | 业务规则验证，返回结果 | ❌ 发送响应 |
| **领域服务** | `services/websocket/` | 领域逻辑，状态管理 | ❌ HTTP/WS 协议 |
| **外部客户端** | `clients/` | 外部 API 调用封装 | ❌ 业务逻辑 |
| **验证模式** | `models/schemas/` | Zod 运行时验证 | ❌ 业务逻辑 |
| **模型层** | `models/entities/` | 数据结构定义 | ❌ 任何逻辑 |
| **DTO层** | `models/dto/` | 传输对象，类型安全 | ❌ 任何逻辑 |
| **类型层** | `types/` | TypeScript 类型定义 | ❌ 任何逻辑 |

## 依赖方向图

```
Routes
  ↓
Controllers
  ↓
Services/Handlers
  ↓
Domain Services / External Clients
  ↓
In-Memory Storage / External APIs (OpenAI, Tencent)
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

### 添加新的 WebSocket 消息类型

```
1. 定义类型
   └─ types/websocket/xxx.ts (消息接口)
   └─ types/websocket/index.ts (导出)

2. 添加消息类型枚举
   └─ types/websocket/base.ts (EWSMessageType 新增值)

3. 创建验证模式
   └─ models/schemas/xxx.schema.ts (Zod schema)

4. 创建 Handler
   └─ services/handlers/xxx-handler.ts (纯函数)

5. 更新 Controller
   └─ controllers/ws-controller.ts (添加 case 分支)

6. 更新 Domain Service (如需要)
   └─ services/websocket/xxx-manager.ts
```

### 添加新的 HTTP 端点

```
1. 定义类型
   └─ types/http/xxx.ts 或 types/llm/xxx.ts

2. 创建验证模式
   └─ models/schemas/xxx.schema.ts

3. 创建 Service
   └─ services/core/xxx.service.ts

4. 创建 Controller
   └─ controllers/xxx-controller.ts

5. 创建 Route
   └─ routes/xxx-routes.ts

6. 注册路由
   └─ app.ts (添加 app.use)
```

## 图例说明

- 🔵 **路由层**: URL 定义和映射
- 🟢 **控制器层**: 请求/响应处理
- 🟡 **服务层**: 业务逻辑和编排
- 🌐 **外部客户端**: 第三方 API 调用
- 📊 **模型层**: 数据结构 + Zod 验证
- 📝 **类型层**: TypeScript 类型定义
- 🔢 **常量层**: 配置 + Prompt 模板

---

## 总结

✅ **三层架构已完整实现**
- 清晰的职责分离（HTTP / WebSocket 双通道）
- 标准化的数据流（Handler 纯函数模式）
- 5 种 WebSocket 消息处理器 + 3 条 HTTP 路由
- 游戏编排（震天鼓定时流程）与业务逻辑解耦
- OpenAI / 腾讯云外部服务集成


