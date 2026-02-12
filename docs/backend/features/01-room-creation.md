# 功能文档：创建房间

## 概述

创建房间是用户开启聊天会话的第一步，通过 HTTP POST 请求创建一个新的双人聊天室。

**API Endpoint**: `POST /v1/rooms`

---

## 业务流程

### 流程图

```
用户 → 发送创建请求 → 服务器验证 → 生成房间数据 → 返回房间信息
                            ↓ (失败)
                        返回错误信息
```

### 详细步骤

1. **客户端发起请求**
   - 提供创建者用户信息（userId + nickname）
   - 发送 POST 请求到 `/v1/rooms`

2. **服务器验证输入**
   - 验证 `creator.userId` 和 `creator.nickname` 非空
   - 验证数据格式符合 Zod schema

3. **生成房间数据**
   - 生成唯一 `roomId`（UUID）
   - 生成6位 `roomCode`（大写字母+数字）
   - 设置房间状态为 `WAITING`
   - 记录创建者为 `hostUserId`
   - 初始化参与者列表为空

4. **存储房间数据**
   - 保存到内存 Map（两个索引）
   - `roomId → Room`
   - `roomCode → roomId`

5. **返回结果**
   - 成功：返回完整房间信息
   - 失败：返回错误码和消息

---

## API 规格

### Request

**Method**: `POST`  
**URL**: `http://localhost:8080/v1/rooms`  
**Content-Type**: `application/json`

**Body**:
```typescript
{
  creator: {
    userId: string;    // 创建者唯一标识
    nickname: string;  // 创建者昵称
  }
}
```

**示例**:
```json
{
  "creator": {
    "userId": "user-12345",
    "nickname": "Alice"
  }
}
```

---

### Response

#### 成功响应（201 Created）

```typescript
{
  success: true;
  data: {
    room: {
      roomId: string;           // UUID 格式
      roomCode: string;         // 6位代码（例如：ABC123）
      hostUserId: string;       // 创建者 userId
      participants: [];         // 空数组（需要通过 WebSocket 加入）
      status: "WAITING";        // 初始状态
      createdAt: number;        // Unix 时间戳（毫秒）
    }
  }
}
```

**示例**:
```json
{
  "success": true,
  "data": {
    "room": {
      "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "roomCode": "A1B2C3",
      "hostUserId": "user-12345",
      "participants": [],
      "status": "WAITING",
      "createdAt": 1737849600000
    }
  }
}
```

---

#### 错误响应（400 Bad Request）

**场景**: 输入验证失败

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Creator information is required",
    "details": {
      "field": "creator.userId",
      "issue": "Required field is missing"
    }
  }
}
```

---

#### 错误响应（500 Internal Server Error）

**场景**: 服务器内部错误

```json
{
  "success": false,
  "error": {
    "code": "ROOM_CREATE_FAILED",
    "message": "Failed to create room due to server error"
  }
}
```

---

## 数据模型

### Room Entity

```typescript
interface IRoom {
  roomId: string;              // 唯一房间ID
  roomCode: string;            // 6位邀请代码
  hostUserId: string;          // 房主用户ID
  participants: IParticipant[]; // 参与者列表
  status: ERoomStatus;         // 房间状态
  createdAt: number;           // 创建时间戳
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

interface IUser {
  userId: string;
  nickname: string;
}
```

---

## 业务规则

### 房间代码生成规则

- ✅ 长度固定为6位
- ✅ 仅包含大写字母（A-Z）和数字（0-9）
- ✅ 保证唯一性（检查是否已存在）
- ✅ 示例：`A1B2C3`, `XY9Z01`, `123ABC`

### 初始状态规则

- ✅ 新建房间状态为 `WAITING`
- ✅ 参与者列表为空数组
- ✅ 创建时间为服务器当前时间
- ✅ 房主 ID 保存但不在参与者列表中（需要通过 WebSocket 加入）

### 约束条件

- ❌ 创建房间不会自动加入房间（需要单独的 WebSocket JOIN_ROOM）
- ❌ 房间代码碰撞极低但需要检查（约 36^6 = 21亿种组合）
- ✅ 房间生命周期由连接状态管理（无定时清理）

---

## 错误处理

### 错误码对照表

| 错误码 | HTTP 状态 | 描述 | 解决方案 |
|--------|----------|------|----------|
| `INVALID_REQUEST` | 400 | 请求参数缺失或格式错误 | 检查 creator 字段 |
| `ROOM_CREATE_FAILED` | 500 | 服务器内部错误 | 稍后重试 |

### 客户端错误处理示例

```typescript
async function createRoom(creator: IUser): Promise<IRoom> {
  try {
    const response = await fetch('http://localhost:8080/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error.message);
    }

    return result.data.room;
  } catch (error) {
    console.error('Failed to create room:', error);
    throw error;
  }
}
```

---

## 后端实现

### 代码路径

```
backend/src/
├── routes/room-routes.ts          # 路由定义
├── controllers/room-controller.ts # 请求处理
├── services/core/room-service.ts  # 业务逻辑
└── repositories/room/             # 数据访问
```

### Controller 处理流程

```typescript
// controllers/room-controller.ts
export class RoomController {
  async createRoom(req: Request, res: Response) {
    try {
      // 1. 验证输入（Zod schema）
      const validatedData = createRoomSchema.parse(req.body);

      // 2. 调用服务层
      const room = await this.roomService.createRoom(
        validatedData.creator
      );

      // 3. 返回成功响应
      res.status(201).json({
        success: true,
        data: { room }
      });
    } catch (error) {
      // 4. 统一错误处理
      next(error);
    }
  }
}
```

### Service 业务逻辑

```typescript
// services/core/room-service.ts
export class RoomService {
  async createRoom(creator: IUser): Promise<IRoom> {
    // 1. 生成房间ID和代码
    const roomId = generateUUID();
    const roomCode = this.generateRoomCode();

    // 2. 构建房间实体
    const room: IRoom = {
      roomId,
      roomCode,
      hostUserId: creator.userId,
      participants: [],
      status: ERoomStatus.Waiting,
      createdAt: Date.now()
    };

    // 3. 保存到仓储
    await this.roomRepository.save(room);

    return room;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // 检查唯一性（省略实现）
    return code;
  }
}
```

---

## 测试用例

### 成功场景

```bash
# 测试用例 1: 正常创建
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "creator": {
      "userId": "user-001",
      "nickname": "Alice"
    }
  }'

# 期望结果: 201 Created, 返回房间信息
```

### 失败场景

```bash
# 测试用例 2: 缺少 userId
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "creator": {
      "nickname": "Alice"
    }
  }'

# 期望结果: 400 Bad Request, INVALID_REQUEST

# 测试用例 3: 缺少 creator
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{}'

# 期望结果: 400 Bad Request, INVALID_REQUEST
```

---

## 性能指标

- **响应时间**: < 100ms (P95)
- **吞吐量**: > 100 req/s
- **内存占用**: 每个房间约 1KB

---

## 安全考虑

- ✅ 输入验证（Zod schema）
- ✅ 房间代码随机生成（防止猜测）
- ❌ 无需身份认证（会话级别）
- ❌ 无需防止重复创建（允许同一用户创建多个房间）

---

## 常见问题

### Q1: 创建房间后如何加入？

创建房间不会自动加入，需要通过 WebSocket 发送 `JOIN_ROOM` 消息。详见 [加入房间文档](02-join-room.md)。

### Q2: roomCode 会重复吗？

理论上可能，但概率极低（36^6 约21亿种组合）。后端会检查唯一性。

### Q3: 房间何时被清理？

当前版本没有自动清理机制，服务器重启后所有房间丢失。

### Q4: 可以创建多人房间吗？

不可以，硬编码限制为2人。详见 [产品需求文档](../product-requirements.md)。

---

## 下一步

创建房间后，推荐阅读：
- [加入房间](02-join-room.md) - 如何通过 WebSocket 加入房间
- [连接管理](04-connection-lifecycle.md) - WebSocket 连接流程
- [数据模型](../data-models.md) - 深入理解 Room 实体

---

**相关文档**:
- [返回文档首页](../README.md)
- [WebSocket 协议](02-join-room.md)
- [错误处理](05-error-handling.md)
