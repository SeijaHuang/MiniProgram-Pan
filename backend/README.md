# 聊天室后端服务

基于HTTP + WebSocket的双人聊天室系统，支持房间创建、加入和实时聊天。

## 技术栈

- **Node.js** + **TypeScript**
- **Express** - HTTP服务器
- **WebSocket (ws)** - 实时通信
- **dotenv** - 环境变量管理

## 项目特点

- ✅ 严格的双人房间系统（最多2人）
- ✅ HTTP用于房间创建，WebSocket用于实时通信
- ✅ 房间状态机：WAITING → READY → CLOSED
- ✅ 完整的错误处理和验证
- ✅ TypeScript类型安全

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

```bash
npm run dev
```

服务器将在 `http://localhost:8080` 启动，WebSocket路径为 `ws://localhost:8080/ws`

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
- `ROOM_NOT_READY` - 房间未就绪（需要2人才能聊天）
- `ALREADY_JOINED` - 已加入该房间
- `INTERNAL_ERROR` - 服务器内部错误

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
  READY (2人) ← 可以聊天
     ↓ 有人离开
  CLOSED (删除)
```

---

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 代码检查
npm run lint

# 代码格式化
npm run format

# TypeScript类型检查
npx tsc --noEmit
```

---

## 项目结构

```
backend/
├── src/
│   ├── models/              # 领域模型
│   │   ├── user.ts
│   │   ├── room.ts
│   │   └── message.ts
│   ├── types/               # 类型定义
│   │   ├── http.ts
│   │   └── ws-messages.ts
│   ├── services/            # 业务逻辑
│   │   ├── room-manager.ts
│   │   ├── connection-manager.ts
│   │   └── handlers/
│   ├── constants/
│   ├── utils/
│   ├── app.ts              # Express服务器
│   ├── ws.ts               # WebSocket服务器
│   └── index.ts            # 入口文件
├── .env                     # 环境变量
└── package.json
```

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

- 详细架构文档：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 重构总结：[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)
- 规范文档：[../.cursor/rules/06-create-room-and-chat.md](../.cursor/rules/06-create-room-and-chat.md)

---

## License

ISC
