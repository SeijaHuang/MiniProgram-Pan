# Backend WebSocket Protocol

本文档描述后端 WebSocket 通信协议规范。

## 连接信息

| 属性 | 值 |
|------|-----|
| URL | `ws://localhost:8080/ws` |
| 协议 | WebSocket |
| 路径 | `/ws` (可通过 `WS_PATH` 环境变量配置) |

## 消息格式

所有 WebSocket 消息采用 JSON 格式。

### 基础消息结构

```typescript
interface IWSMessage<T> {
    type: string;       // 消息类型
    data: T;            // 消息数据
    timestamp: number;  // 时间戳 (毫秒)
}
```

## 消息类型

### 客户端 → 服务器

| 类型 | 描述 |
|------|------|
| `JOIN_ROOM` | 加入房间 |
| `CHAT_SEND` | 发送聊天消息 |

### 服务器 → 客户端

| 类型 | 描述 |
|------|------|
| `JOIN_ACK` | 加入房间确认 |
| `CHAT_RECEIVE` | 接收聊天消息 |
| `ERROR` | 错误消息 |

---

## 客户端消息

### JOIN_ROOM

加入指定房间。

**请求**

```typescript
{
    type: "JOIN_ROOM";
    data: {
        roomCode: string;  // 6位数字房间码
        user: {
            userId: string;
            nickname: string;
        };
    };
    timestamp: number;
}
```

**示例**

```json
{
    "type": "JOIN_ROOM",
    "data": {
        "roomCode": "123456",
        "user": {
            "userId": "user_abc123",
            "nickname": "张三"
        }
    },
    "timestamp": 1706184000000
}
```

**验证规则**

- `roomCode`: 必填，6位数字字符串
- `user.userId`: 必填，非空字符串
- `user.nickname`: 必填，非空字符串

**业务验证**

- 房间必须存在
- 房间状态必须为 `WAITING`
- 房间未满 (< 2 人)
- 用户未重复加入

**响应**

- 成功: 广播 `JOIN_ACK` 给所有参与者
- 失败: 发送 `ERROR` 给请求者

---

### CHAT_SEND

发送聊天消息。

**请求**

```typescript
{
    type: "CHAT_SEND";
    data: {
        content: {
            type: "TEXT";
            text: string;
        };
    };
    timestamp: number;
}
```

**示例**

```json
{
    "type": "CHAT_SEND",
    "data": {
        "content": {
            "type": "TEXT",
            "text": "你好，世界！"
        }
    },
    "timestamp": 1706184000000
}
```

**验证规则**

- `content.type`: 必须为 `"TEXT"`
- `content.text`: 必填，非空字符串

**业务验证**

- 用户必须已加入房间 (连接已绑定)
- 房间必须存在
- 房间状态必须为 `READY` (2 人已加入)
- 发送者必须是房间参与者

**响应**

- 成功: 广播 `CHAT_RECEIVE` 给所有参与者
- 失败: 发送 `ERROR` 给请求者

---

## 服务器消息

### JOIN_ACK

加入房间确认，广播给所有参与者。

**响应**

```typescript
{
    type: "JOIN_ACK";
    data: {
        room: {
            roomId: string;
            roomCode: string;
            hostUserId: string;
            participants: Array<{
                user: {
                    userId: string;
                    nickname: string;
                };
                joinedAt: number;
            }>;
            status: "WAITING" | "READY" | "CLOSED";
            createdAt: number;
        };
    };
    timestamp: number;
}
```

**示例**

```json
{
    "type": "JOIN_ACK",
    "data": {
        "room": {
            "roomId": "room_a1b2c3d4e5f6",
            "roomCode": "123456",
            "hostUserId": "user_abc123",
            "participants": [
                {
                    "user": {
                        "userId": "user_abc123",
                        "nickname": "张三"
                    },
                    "joinedAt": 1706184000000
                },
                {
                    "user": {
                        "userId": "user_def456",
                        "nickname": "李四"
                    },
                    "joinedAt": 1706184030000
                }
            ],
            "status": "READY",
            "createdAt": 1706183900000
        }
    },
    "timestamp": 1706184030000
}
```

---

### CHAT_RECEIVE

接收聊天消息，广播给所有参与者。

**响应**

```typescript
{
    type: "CHAT_RECEIVE";
    data: {
        message: {
            messageId: string;
            roomId: string;
            sender: {
                userId: string;
                nickname: string;
            };
            type: "TEXT";
            content: {
                type: "TEXT";
                text: string;
            };
            createdAt: number;
        };
    };
    timestamp: number;
}
```

**示例**

```json
{
    "type": "CHAT_RECEIVE",
    "data": {
        "message": {
            "messageId": "msg_x1y2z3",
            "roomId": "room_a1b2c3d4e5f6",
            "sender": {
                "userId": "user_abc123",
                "nickname": "张三"
            },
            "type": "TEXT",
            "content": {
                "type": "TEXT",
                "text": "你好，世界！"
            },
            "createdAt": 1706184060000
        }
    },
    "timestamp": 1706184060000
}
```

---

### ERROR

错误消息，发送给请求者。

**响应**

```typescript
{
    type: "ERROR";
    data: {
        code: EWSErrorCode;
        message?: string;
    };
    timestamp: number;
}
```

**示例**

```json
{
    "type": "ERROR",
    "data": {
        "code": "ROOM_NOT_FOUND",
        "message": "房间不存在"
    },
    "timestamp": 1706184000000
}
```

---

## 错误码

| 错误码 | 描述 |
|--------|------|
| `INVALID_PAYLOAD` | 消息格式无效 |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `ROOM_FULL` | 房间已满 (已有 2 人) |
| `ROOM_CLOSED` | 房间已关闭 |
| `NOT_PARTICIPANT` | 用户不在房间中 |
| `ROOM_NOT_READY` | 房间未就绪 (需要 2 人才能聊天) |
| `ALREADY_JOINED` | 用户已在房间中 |
| `INTERNAL_ERROR` | 服务器内部错误 |

---

## 连接生命周期

### 1. 建立连接

```
客户端 ──── WebSocket 连接 ────▶ 服务器
                                    │
                         生成 connectionId
                         注册到 ConnectionManager
```

### 2. 加入房间

```
客户端 ──── JOIN_ROOM ────▶ 服务器
                               │
                        验证 roomCode
                        验证房间状态
                        添加参与者
                        绑定连接
                               │
客户端 ◀──── JOIN_ACK ──── 广播给所有参与者
```

### 3. 发送消息

```
客户端 ──── CHAT_SEND ────▶ 服务器
                               │
                        验证连接绑定
                        验证房间状态
                        创建消息实体
                               │
客户端 ◀── CHAT_RECEIVE ── 广播给所有参与者
```

### 4. 断开连接

```
客户端 ──── 断开连接 ────▶ 服务器
                              │
                       从房间移除用户
                       更新房间状态
                       清理连接映射
```

---

## 房间状态流转

```
创建房间 (HTTP)
      │
      ▼
   WAITING  ◀── 0-1 人在房间
      │
      │ 第二个用户加入
      ▼
    READY   ◀── 2 人在房间，可以聊天
      │
      │ 有用户断开连接
      ▼
   CLOSED   ◀── 房间关闭/删除
```

---

## 使用示例

### JavaScript

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('连接已建立');

    // 加入房间
    ws.send(
        JSON.stringify({
            type: 'JOIN_ROOM',
            data: {
                roomCode: '123456',
                user: {
                    userId: 'user_123',
                    nickname: '张三',
                },
            },
            timestamp: Date.now(),
        })
    );
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'JOIN_ACK':
            console.log('加入房间成功:', message.data.room);
            break;
        case 'CHAT_RECEIVE':
            console.log('收到消息:', message.data.message);
            break;
        case 'ERROR':
            console.error('错误:', message.data.code, message.data.message);
            break;
    }
};

ws.onclose = () => {
    console.log('连接已关闭');
};

// 发送聊天消息
function sendMessage(text) {
    ws.send(
        JSON.stringify({
            type: 'CHAT_SEND',
            data: {
                content: {
                    type: 'TEXT',
                    text: text,
                },
            },
            timestamp: Date.now(),
        })
    );
}
```

### 微信小程序

```typescript
const socketTask = wx.connectSocket({
    url: 'ws://localhost:8080/ws',
});

socketTask.onOpen(() => {
    console.log('连接已建立');

    socketTask.send({
        data: JSON.stringify({
            type: 'JOIN_ROOM',
            data: {
                roomCode: '123456',
                user: {
                    userId: 'user_123',
                    nickname: '张三',
                },
            },
            timestamp: Date.now(),
        }),
    });
});

socketTask.onMessage((res) => {
    const message = JSON.parse(res.data as string);

    switch (message.type) {
        case 'JOIN_ACK':
            console.log('加入房间成功:', message.data.room);
            break;
        case 'CHAT_RECEIVE':
            console.log('收到消息:', message.data.message);
            break;
        case 'ERROR':
            console.error('错误:', message.data.code);
            break;
    }
});

socketTask.onClose(() => {
    console.log('连接已关闭');
});
```

---

## 注意事项

1. **消息顺序**: WebSocket 保证消息按发送顺序到达
2. **连接唯一性**: 每个 WebSocket 连接有唯一的 `connectionId`
3. **房间绑定**: 用户必须先发送 `JOIN_ROOM` 才能发送 `CHAT_SEND`
4. **广播机制**: `JOIN_ACK` 和 `CHAT_RECEIVE` 会广播给房间内所有参与者
5. **断线处理**: 当前版本不支持自动重连，断线后需重新加入房间
