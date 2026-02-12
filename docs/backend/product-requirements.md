# 后端功能需求文档 (PRD)

## 1. 产品概述

### 1.1 产品定位

双人实时聊天室后端服务，为微信小程序「情侣审判」提供房间管理和实时通信能力。

### 1.2 核心价值

- **简单快速**: 6位房间代码，无需注册登录
- **实时同步**: WebSocket 确保双方消息即时送达
- **严格限制**: 每个房间仅限2人，确保私密性
- **状态驱动**: 自动化的房间状态管理

### 1.3 技术选型理由

| 技术 | 理由 |
|------|------|
| Express | 轻量级、成熟的 HTTP 框架 |
| WebSocket (ws) | 原生 WebSocket 协议，性能最优 |
| TypeScript | 类型安全，减少运行时错误 |
| In-Memory Storage | 无需数据库，降低部署复杂度 |

---

## 2. 功能需求

### 2.1 房间管理

#### 功能 1.1: 创建房间

**需求描述**:
- 用户可以创建一个新的双人聊天室
- 系统生成唯一的6位房间代码供分享
- 创建者自动成为房主

**业务规则**:
- ✅ 每个房间有唯一的 `roomId` 和 `roomCode`
- ✅ `roomCode` 长度固定为6位，包含大写字母和数字
- ✅ 新建房间状态为 `WAITING`
- ✅ 新建房间参与者列表为空（需要通过 WebSocket 加入）
- ✅ 记录创建者 `hostUserId`

**输入**:
```typescript
{
  creator: {
    userId: string,
    nickname: string
  }
}
```

**输出**:
```typescript
{
  room: {
    roomId: string,
    roomCode: string,
    hostUserId: string,
    participants: [],
    status: "WAITING",
    createdAt: number
  }
}
```

**异常处理**:
- 缺少必填字段 → 返回 400 `INVALID_REQUEST`
- 服务器错误 → 返回 500 `ROOM_CREATE_FAILED`

---

#### 功能 1.2: 加入房间

**需求描述**:
- 用户通过6位房间代码加入房间
- 使用 WebSocket 进行身份验证和状态同步
- 第二个用户加入时房间状态自动变为 `READY`

**业务规则**:
- ✅ 房间代码必须存在
- ✅ 房间状态必须为 `WAITING` 或 `READY`
- ✅ 房间参与者不超过2人
- ✅ 同一用户不能重复加入
- ✅ 成功加入后广播更新后的房间状态给所有参与者

**输入** (WebSocket Message):
```typescript
{
  type: "JOIN_ROOM",
  data: {
    roomCode: string,
    user: {
      userId: string,
      nickname: string
    }
  }
}
```

**输出** (广播给所有参与者):
```typescript
{
  type: "JOIN_ACK",
  data: {
    room: IRoom  // 更新后的完整房间信息
  }
}
```

**异常处理**:
- 房间代码不存在 → `ROOM_NOT_FOUND`
- 房间已满 → `ROOM_FULL`
- 房间已关闭 → `ROOM_CLOSED`
- 用户已在房间 → `ALREADY_JOINED`

---

### 2.2 实时聊天

#### 功能 2.1: 发送消息

**需求描述**:
- 参与者可以发送文本消息
- 消息实时广播给房间内所有用户（包括发送者）
- 服务器生成消息ID和时间戳

**业务规则**:
- ✅ 发送者必须是房间参与者
- ✅ 房间状态必须为 `READY`（双方就位）
- ✅ 消息内容不能为空
- ✅ 服务器生成唯一 `messageId`
- ✅ 使用服务器时间戳（避免客户端时间不一致）
- ✅ 广播给所有参与者（确保状态同步）

**输入** (WebSocket Message):
```typescript
{
  type: "CHAT_SEND",
  data: {
    content: {
      type: "TEXT",
      text: string
    }
  }
}
```

**输出** (广播给所有参与者):
```typescript
{
  type: "CHAT_RECEIVE",
  data: {
    message: {
      messageId: string,
      roomId: string,
      sender: IUser,
      type: "TEXT",
      content: {
        type: "TEXT",
        text: string
      },
      createdAt: number
    }
  }
}
```

**异常处理**:
- 用户不是参与者 → `NOT_PARTICIPANT`
- 房间未就绪 → `ROOM_NOT_READY`
- 消息内容为空 → `INVALID_PAYLOAD`

---

### 2.3 连接管理

#### 功能 3.1: WebSocket 连接生命周期

**需求描述**:
- 管理 WebSocket 连接的建立和断开
- 自动清理断开连接的用户

**业务规则**:
- ✅ 每个连接分配唯一 `connectionId`
- ✅ 连接断开时从房间移除用户
- ✅ 连接断开时通知其他参与者（可选）
- ✅ 记录连接与用户/房间的映射关系

**连接流程**:
```
1. 客户端连接 WebSocket
2. 服务器生成 connectionId
3. 客户端发送 JOIN_ROOM 消息
4. 服务器绑定 connectionId ↔ userId ↔ roomId
5. 断开时自动解除绑定
```

---

## 3. 数据模型

### 3.1 房间 (Room)

**实体定义**:
```typescript
interface IRoom {
  roomId: string;        // 唯一房间ID
  roomCode: string;      // 6位邀请代码
  hostUserId: string;    // 房主用户ID
  participants: IParticipant[];
  status: ERoomStatus;
  createdAt: number;
}

enum ERoomStatus {
  Waiting = "WAITING",   // 等待第二个用户
  Ready = "READY",       // 双方就位
  Closed = "CLOSED"      // 房间关闭
}

interface IParticipant {
  user: IUser;
  joinedAt: number;
}
```

**状态转换**:
```
[创建] → WAITING (0人)
[房主加入] → WAITING (1人)
[访客加入] → READY (2人)
[断开/关闭] → CLOSED
```

**存储方式**:
- 内存存储（Map）
- 两个索引：roomId → Room, roomCode → roomId

**生命周期**:
- 创建: HTTP POST /v1/rooms
- 激活: WebSocket JOIN_ROOM
- 就绪: 第二个用户加入
- 清理: 连接断开或服务器重启

---

### 3.2 用户 (User)

**实体定义**:
```typescript
interface IUser {
  userId: string;    // 客户端生成的唯一标识
  nickname: string;  // 用户昵称
}
```

**特点**:
- 会话级别，不涉及持久化
- `userId` 由客户端生成和管理
- 服务器仅验证格式，不管理用户账户

---

### 3.3 消息 (Message)

**实体定义**:
```typescript
interface IMessage {
  messageId: string;     // 服务器生成
  roomId: string;
  sender: IUser;
  type: EMessageType;
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

**存储方式**:
- 当前不持久化（仅实时转发）
- 未来可扩展消息历史功能

---

### 3.4 连接 (Connection)

**实体定义**:
```typescript
interface IConnectionData {
  connectionId: string;
  socket: WebSocket;
  userId?: string;       // 加入房间后绑定
  roomId?: string;       // 加入房间后绑定
}
```

**索引**:
- connectionId → ConnectionData
- userId → connectionId

**用途**:
- 分离运行时连接数据和领域模型
- 支持消息路由和广播
- 管理连接生命周期

---

## 4. 接口设计

> **详细 API 规格请参考：**
> - **HTTP API**: [features/01-room-creation.md](./features/01-room-creation.md)
> - **WebSocket 协议**: [features/02-join-room.md](./features/02-join-room.md), [features/03-chat-messaging.md](./features/03-chat-messaging.md)
> - **完整 API 文档**: [api-specification.md](./api-specification.md)

### 4.1 HTTP 接口概览

| Endpoint | 方法 | 功能 | 详细文档 |
|----------|------|------|----------|
| `/v1/rooms` | POST | 创建房间 | [01-room-creation.md](./features/01-room-creation.md) |

### 4.2 WebSocket 消息类型

| 消息类型 | 方向 | 功能 | 详细文档 |
|----------|------|------|----------|
| `JOIN_ROOM` | Client → Server | 加入房间 | [02-join-room.md](./features/02-join-room.md) |
| `JOIN_ACK` | Server → Client | 加入确认（广播） | [02-join-room.md](./features/02-join-room.md) |
| `CHAT_SEND` | Client → Server | 发送消息 | [03-chat-messaging.md](./features/03-chat-messaging.md) |
| `CHAT_RECEIVE` | Server → Client | 接收消息（广播） | [03-chat-messaging.md](./features/03-chat-messaging.md) |
| `ERROR` | Server → Client | 错误通知 | [05-error-handling.md](./features/05-error-handling.md) |

---

## 5. 非功能需求

### 5.1 性能要求

| 指标 | 目标 |
|------|------|
| HTTP 响应时间 | < 100ms |
| WebSocket 消息延迟 | < 50ms |
| 并发房间数 | 100+ |
| 并发连接数 | 200+ |

### 5.2 可靠性要求

- ✅ 自动重连机制（客户端实现）
- ✅ 连接断开自动清理
- ✅ 错误信息明确可操作

### 5.3 安全性要求

- ✅ 输入验证（Zod schema）
- ✅ 房间代码随机生成（防止碰撞）
- ✅ 参与者权限验证
- ❌ 不涉及用户认证（会话级别）
- ❌ 不涉及加密传输（内网部署）

### 5.4 可维护性要求

- ✅ TypeScript 类型安全
- ✅ 三层架构，职责分离
- ✅ 完整的代码注释
- ✅ 单元测试覆盖（待实现）

---

## 6. 约束与限制

### 6.1 功能约束

- ❌ 每个房间最多2人（硬限制）
- ❌ 仅支持文本消息（当前版本）
- ❌ 不支持消息历史（未来扩展）
- ❌ 不支持用户注册/登录

### 6.2 技术约束

- ✅ Node.js 18+
- ✅ 内存存储（无数据库）
- ✅ 单实例部署（不支持集群）

### 6.3 部署约束

- ✅ Docker 容器化部署
- ✅ 环境变量配置
- ❌ 不支持水平扩展（共享状态问题）

---

## 7. 未来扩展

### 7.1 短期扩展（优先级 P1）

- [ ] 消息历史存储和查询
- [ ] 房间持久化（MongoDB）
- [ ] 心跳检测和超时清理
- [ ] 单元测试和集成测试

### 7.2 中期扩展（优先级 P2）

- [ ] 用户认证（JWT）
- [ ] 更多消息类型（图片、语音）
- [ ] 房间管理功能（关闭、重开）
- [ ] 性能监控和日志

### 7.3 长期扩展（优先级 P3）

- [ ] 集群部署支持（Redis 共享状态）
- [ ] 消息加密
- [ ] 多房间支持（3人以上）
- [ ] WebRTC 语音/视频通话

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 创建房间返回正确的房间信息
- [ ] 两个用户可以成功加入同一房间
- [ ] 房间状态自动从 WAITING 变为 READY
- [ ] 消息可以实时广播给所有参与者
- [ ] 第三个用户加入失败并返回 ROOM_FULL 错误
- [ ] 连接断开后用户自动从房间移除

### 8.2 性能验收

- [ ] 创建房间响应时间 < 100ms
- [ ] 消息广播延迟 < 50ms
- [ ] 支持 100 个并发房间
- [ ] 支持 200 个并发 WebSocket 连接

### 8.3 错误处理验收

- [ ] 所有错误返回明确的错误代码
- [ ] 无效输入返回 400 错误
- [ ] 服务器错误返回 500 错误
- [ ] WebSocket 错误通过 ERROR 消息通知

---

## 9. 产品里程碑

### Phase 1: MVP（已完成）

- ✅ HTTP 房间创建
- ✅ WebSocket 加入房间
- ✅ 实时聊天消息
- ✅ 基本错误处理
- ✅ 内存存储

### Phase 2: 优化（进行中）

- ✅ 完整的类型定义
- ✅ Zod 运行时验证
- ✅ 三层架构重构
- ⏳ 单元测试
- ⏳ 性能优化

### Phase 3: 生产就绪（未来）

- ⏳ 数据库集成
- ⏳ 消息历史
- ⏳ 用户认证
- ⏳ 监控和日志
- ⏳ 集群部署

---

## 10. 相关文档

- **功能详细文档**: [features/](./features/) - 按功能模块的详细实现文档
- **API 完整规格**: [api-specification.md](./api-specification.md) - 所有 API 的完整规格说明
- **数据模型**: [data-models.md](./data-models.md) - 所有实体和类型定义
- **架构可视化**: [architecture-visual.md](./architecture-visual.md) - 三层架构图解
- **后端 README**: [../README.md](../README.md) - 快速开始和部署指南

---

## 附录A: 术语表

| 术语 | 定义 |
|------|------|
| Room | 双人聊天室，由6位代码标识 |
| Host | 房主，创建房间的用户 |
| Guest | 访客，通过代码加入的用户 |
| Participant | 参与者，房间内的用户 |
| roomCode | 6位房间邀请代码 |
| roomId | 服务器生成的唯一房间标识 |
| connectionId | WebSocket 连接唯一标识 |
| Broadcast | 向房间内所有参与者发送消息 |

---

## 附录B: 决策记录

### 为什么使用内存存储而不是数据库？

**决策**: 当前版本使用内存 Map 存储房间数据

**理由**:
- ✅ 降低部署复杂度（无需数据库）
- ✅ 性能最优（内存访问）
- ✅ 适合短生命周期房间（会话级别）
- ✅ Repository 模式已预留数据库扩展接口

**取舍**:
- ❌ 服务器重启后数据丢失
- ❌ 不支持多实例部署
- ❌ 不支持消息历史查询

### 为什么限制每个房间最多2人？

**决策**: 硬编码 `MAX_PARTICIPANTS = 2`

**理由**:
- ✅ 产品定位：情侣/双人场景
- ✅ 简化状态管理（双方就位即开始）
- ✅ 降低消息广播复杂度
- ✅ 确保私密性

**未来**: 如需支持多人，可配置化该限制

### 为什么消息不持久化？

**决策**: 当前仅实时转发，不存储消息

**理由**:
- ✅ MVP 阶段，简化实现
- ✅ 减少存储成本
- ✅ 聊天内容短生命周期

**未来**: Phase 3 添加消息历史功能
