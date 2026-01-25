# Backend HTTP API

本文档描述后端 HTTP API 接口规范。

## 基础信息

| 属性 | 值 |
|------|-----|
| Base URL | `http://localhost:8080` |
| Content-Type | `application/json` |

## 响应格式

### 成功响应

```typescript
{
    success: true;
    data: T; // 具体数据
}
```

### 错误响应

```typescript
{
    success: false;
    error: {
        code: string;      // 错误码
        message: string;   // 错误描述
    }
}
```

## API 端点

### 健康检查

检查服务器运行状态。

```
GET /health
```

**响应**

```json
{
    "ok": true
}
```

---

### 创建房间

创建一个新的两人聊天房间。

```
POST /room/create
```

**请求体**

```typescript
{
    creator: {
        userId: string;    // 用户唯一标识
        nickname: string;  // 用户昵称
    }
}
```

**请求示例**

```json
{
    "creator": {
        "userId": "user_abc123",
        "nickname": "张三"
    }
}
```

**成功响应 (201 Created)**

```typescript
{
    success: true;
    data: {
        room: {
            roomId: string;        // 房间唯一标识 (格式: "room_{hex}")
            roomCode: string;      // 6位数字房间码
            hostUserId: string;    // 房主用户ID
            participants: [];      // 参与者列表 (初始为空)
            status: "WAITING";     // 房间状态
            createdAt: number;     // 创建时间戳
        }
    }
}
```

**响应示例**

```json
{
    "success": true,
    "data": {
        "room": {
            "roomId": "room_a1b2c3d4e5f6",
            "roomCode": "123456",
            "hostUserId": "user_abc123",
            "participants": [],
            "status": "WAITING",
            "createdAt": 1706184000000
        }
    }
}
```

**错误响应**

| HTTP 状态码 | 错误码 | 描述 |
|------------|--------|------|
| 400 | `VALIDATION_ERROR` | 请求参数验证失败 |
| 500 | `ROOM_CREATION_FAILED` | 房间创建失败 |

**错误响应示例**

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "creator.userId is required"
    }
}
```

## 错误码说明

### HTTP 错误码

| 错误码 | 描述 |
|--------|------|
| `VALIDATION_ERROR` | 请求参数验证失败 |
| `ROOM_CREATION_FAILED` | 房间创建失败 |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `INTERNAL_ERROR` | 服务器内部错误 |

## 请求验证

使用 Zod 进行运行时验证。

### CreateRoom 验证规则

```typescript
const createRoomSchema = z.object({
    creator: z.object({
        userId: z.string().min(1),
        nickname: z.string().min(1),
    }),
});
```

## 使用示例

### cURL

```bash
# 健康检查
curl http://localhost:8080/health

# 创建房间
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"user_123","nickname":"张三"}}'
```

### JavaScript (Fetch)

```javascript
// 创建房间
const response = await fetch('http://localhost:8080/room/create', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        creator: {
            userId: 'user_123',
            nickname: '张三',
        },
    }),
});

const result = await response.json();
if (result.success) {
    console.log('房间码:', result.data.room.roomCode);
}
```

### 微信小程序

```typescript
wx.request({
    url: 'http://localhost:8080/room/create',
    method: 'POST',
    data: {
        creator: {
            userId: 'user_123',
            nickname: '张三',
        },
    },
    success(res) {
        if (res.data.success) {
            const roomCode = res.data.data.room.roomCode;
            console.log('房间码:', roomCode);
        }
    },
});
```

## 注意事项

1. **房间码有效期**: 房间创建后处于 `WAITING` 状态，等待第二个用户加入
2. **最大参与者**: 每个房间最多 2 人
3. **房间状态流转**: `WAITING` → `READY` → `CLOSED`
4. **无持久化**: 当前版本房间数据存储在内存中，服务器重启后丢失
