# 功能文档：错误处理

## 概述

统一的错误处理机制，涵盖 HTTP API 和 WebSocket 协议的所有错误场景。

---

## 错误响应格式

### HTTP 错误响应

**格式**:
```typescript
{
  success: false;
  error: {
    code: string;         // 错误码（枚举）
    message: string;      // 人类可读的错误描述
    details?: any;        // 可选的详细信息
  }
}
```

**示例**:
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

### WebSocket 错误消息

**格式**:
```typescript
{
  type: "ERROR";
  data: {
    code: EWSErrorCode;   // WebSocket 错误码
    message: string;      // 错误描述
    context?: any;        // 可选的上下文信息
  };
  timestamp: number;      // 服务器时间戳
}
```

**示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with code ABC123 does not exist",
    "context": {
      "roomCode": "ABC123"
    }
  },
  "timestamp": 1737849800000
}
```

---

## HTTP 错误码

### 错误码定义

```typescript
enum EHTTPErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  RoomCreateFailed = "ROOM_CREATE_FAILED",
  InternalServerError = "INTERNAL_SERVER_ERROR"
}
```

### 错误码对照表

| 错误码 | HTTP 状态 | 描述 | 常见原因 | 客户端处理 |
|--------|----------|------|----------|----------|
| `INVALID_REQUEST` | 400 | 请求参数无效 | 缺少必填字段、格式错误 | 检查请求参数 |
| `ROOM_CREATE_FAILED` | 500 | 房间创建失败 | 服务器内部错误 | 提示用户重试 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 | 未预期的异常 | 提示用户联系支持 |

---

### 详细说明

#### INVALID_REQUEST

**触发条件**:
- 缺少 `creator` 字段
- 缺少 `creator.userId` 或 `creator.nickname`
- 字段类型错误（例如 userId 不是字符串）

**响应示例**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Validation failed",
    "details": {
      "issues": [
        {
          "field": "creator.userId",
          "message": "Required"
        }
      ]
    }
  }
}
```

**客户端处理**:
```typescript
if (error.code === 'INVALID_REQUEST') {
  console.error('Invalid request:', error.details);
  wx.showToast({
    title: '请求参数错误',
    icon: 'error'
  });
}
```

---

#### ROOM_CREATE_FAILED

**触发条件**:
- 数据库保存失败
- 房间代码生成冲突（极少见）
- 内存不足

**响应示例**:
```json
{
  "success": false,
  "error": {
    "code": "ROOM_CREATE_FAILED",
    "message": "Failed to create room due to server error"
  }
}
```

**客户端处理**:
```typescript
if (error.code === 'ROOM_CREATE_FAILED') {
  wx.showToast({
    title: '创建房间失败，请重试',
    icon: 'error'
  });
}
```

---

## WebSocket 错误码

### 错误码定义

```typescript
enum EWSErrorCode {
  // 房间相关
  RoomNotFound = "ROOM_NOT_FOUND",
  RoomFull = "ROOM_FULL",
  RoomClosed = "ROOM_CLOSED",
  RoomNotReady = "ROOM_NOT_READY",
  AlreadyJoined = "ALREADY_JOINED",

  // 消息相关
  InvalidPayload = "INVALID_PAYLOAD",
  MessageSendFailed = "MESSAGE_SEND_FAILED",
  UnknownMessageType = "UNKNOWN_MESSAGE_TYPE",

  // 权限相关
  NotParticipant = "NOT_PARTICIPANT",
  Unauthorized = "UNAUTHORIZED",

  // 连接相关
  ConnectionFailed = "CONNECTION_FAILED"
}
```

---

### 房间相关错误

#### ROOM_NOT_FOUND

**触发条件**: 房间代码不存在

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with code ABC123 does not exist",
    "context": {
      "roomCode": "ABC123"
    }
  },
  "timestamp": 1737849800000
}
```

**客户端处理**:
```typescript
case 'ROOM_NOT_FOUND':
  page.setData({
    errorType: 'ROOM_NOT_FOUND',
    errorMessage: '房间不存在，请检查房间代码'
  });
  break;
```

---

#### ROOM_FULL

**触发条件**: 房间已有2名参与者

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_FULL",
    "message": "Room is full (max 2 participants)",
    "context": {
      "roomCode": "ABC123",
      "currentParticipants": 2
    }
  }
}
```

**客户端处理**:
```typescript
case 'ROOM_FULL':
  page.setData({
    errorType: 'ROOM_FULL',
    errorMessage: '房间已满，请稍后再试'
  });
  break;
```

---

#### ROOM_CLOSED

**触发条件**: 房间状态为 `CLOSED`

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_CLOSED",
    "message": "Room is closed",
    "context": {
      "roomCode": "ABC123"
    }
  }
}
```

**客户端处理**:
```typescript
case 'ROOM_CLOSED':
  page.setData({
    errorType: 'ROOM_CLOSED',
    errorMessage: '房间已关闭'
  });
  break;
```

---

#### ROOM_NOT_READY

**触发条件**: 房间状态为 `WAITING`（只有一个人），尝试发送消息

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ROOM_NOT_READY",
    "message": "Cannot send message: room status is WAITING",
    "context": {
      "roomStatus": "WAITING"
    }
  }
}
```

**客户端处理**:
```typescript
case 'ROOM_NOT_READY':
  page.setData({
    errorType: 'ROOM_NOT_READY',
    errorMessage: '等待对方加入...'
  });
  break;
```

---

#### ALREADY_JOINED

**触发条件**: 用户尝试重复加入同一房间

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "ALREADY_JOINED",
    "message": "User is already a participant of this room",
    "context": {
      "userId": "user-001",
      "roomCode": "ABC123"
    }
  }
}
```

**客户端处理**:
```typescript
case 'ALREADY_JOINED':
  // 可以忽略，或者提示用户
  console.log('Already joined, ignoring...');
  break;
```

---

### 消息相关错误

#### INVALID_PAYLOAD

**触发条件**:
- 消息 JSON 格式错误
- 缺少必填字段
- 消息内容为空

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "INVALID_PAYLOAD",
    "message": "Invalid message format or missing required fields",
    "context": {
      "field": "content.text",
      "issue": "Cannot be empty"
    }
  }
}
```

**客户端处理**:
```typescript
case 'INVALID_PAYLOAD':
  console.error('Invalid message format');
  wx.showToast({
    title: '消息格式错误',
    icon: 'error'
  });
  break;
```

---

#### MESSAGE_SEND_FAILED

**触发条件**: 服务器发送消息时异常

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "MESSAGE_SEND_FAILED",
    "message": "Failed to send message due to server error"
  }
}
```

**客户端处理**:
```typescript
case 'MESSAGE_SEND_FAILED':
  wx.showToast({
    title: '发送失败，请重试',
    icon: 'error'
  });
  break;
```

---

#### UNKNOWN_MESSAGE_TYPE

**触发条件**: 消息类型不在支持列表中

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "UNKNOWN_MESSAGE_TYPE",
    "message": "Unknown message type: INVALID_TYPE",
    "context": {
      "receivedType": "INVALID_TYPE"
    }
  }
}
```

**客户端处理**:
```typescript
case 'UNKNOWN_MESSAGE_TYPE':
  console.error('Unknown message type');
  break;
```

---

### 权限相关错误

#### NOT_PARTICIPANT

**触发条件**:
- 用户未加入房间就尝试发送消息
- 连接未绑定 userId 或 roomId

**响应示例**:
```json
{
  "type": "ERROR",
  "data": {
    "code": "NOT_PARTICIPANT",
    "message": "User is not a participant of this room",
    "context": {
      "userId": "user-999"
    }
  }
}
```

**客户端处理**:
```typescript
case 'NOT_PARTICIPANT':
  page.setData({
    errorType: 'NOT_PARTICIPANT',
    errorMessage: '请先加入房间'
  });
  // 重定向到加入房间页面
  wx.navigateTo({ url: '/pages/welcome/index' });
  break;
```

---

## 错误处理最佳实践

### 后端实现

#### 统一错误处理中间件

```typescript
// middlewares/error/error-handler.middleware.ts
export class ErrorHandlerMiddleware {
  handle(
    error: Error, 
    req: Request, 
    res: Response, 
    next: NextFunction
  ): void {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Validation failed',
          details: error.errors
        }
      });
    } else if (error instanceof RoomCreateError) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ROOM_CREATE_FAILED',
          message: error.message
        }
      });
    } else {
      console.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
}
```

#### WebSocket 错误发送

```typescript
// services/websocket/ws-manager.ts
sendError(
  connectionId: string, 
  code: EWSErrorCode,
  context?: any
): void {
  const errorMessage: IErrorMessage = {
    type: 'ERROR',
    data: {
      code,
      message: this.getErrorMessage(code),
      context
    },
    timestamp: Date.now()
  };

  this.send(connectionId, errorMessage);
}

private getErrorMessage(code: EWSErrorCode): string {
  const messages: Record<EWSErrorCode, string> = {
    ROOM_NOT_FOUND: 'Room does not exist',
    ROOM_FULL: 'Room is full (max 2 participants)',
    ROOM_CLOSED: 'Room is closed',
    ROOM_NOT_READY: 'Room is not ready',
    ALREADY_JOINED: 'User already joined',
    INVALID_PAYLOAD: 'Invalid message format',
    MESSAGE_SEND_FAILED: 'Failed to send message',
    UNKNOWN_MESSAGE_TYPE: 'Unknown message type',
    NOT_PARTICIPANT: 'User is not a participant',
    UNAUTHORIZED: 'Unauthorized',
    CONNECTION_FAILED: 'Connection failed'
  };

  return messages[code] || 'Unknown error';
}
```

---

### 前端实现

#### 统一错误处理

```typescript
// miniprogram/services/websocket-manager.ts
class WebSocketManager {
  private handleError(error: IErrorMessage): void {
    const { code, message, context } = error.data;

    console.error(`[WS Error] ${code}: ${message}`, context);

    // 获取当前页面
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;

    // 设置错误状态
    currentPage.setData({
      errorType: code,
      errorMessage: this.getLocalizedMessage(code)
    });

    // 某些错误需要特殊处理
    switch (code) {
      case 'ROOM_NOT_FOUND':
      case 'ROOM_CLOSED':
        // 返回首页
        wx.redirectTo({ url: '/pages/welcome/index' });
        break;

      case 'NOT_PARTICIPANT':
        // 重新加入房间
        wx.showModal({
          title: '提示',
          content: '请先加入房间',
          showCancel: false
        });
        break;

      case 'ROOM_NOT_READY':
        // 仅显示提示，不影响操作
        break;

      default:
        // 通用错误提示
        wx.showToast({
          title: '操作失败',
          icon: 'error'
        });
    }
  }

  private getLocalizedMessage(code: EWSErrorCode): string {
    const messages: Record<EWSErrorCode, string> = {
      ROOM_NOT_FOUND: '房间不存在',
      ROOM_FULL: '房间已满',
      ROOM_CLOSED: '房间已关闭',
      ROOM_NOT_READY: '等待对方加入',
      ALREADY_JOINED: '已经在房间中',
      INVALID_PAYLOAD: '消息格式错误',
      MESSAGE_SEND_FAILED: '发送失败',
      UNKNOWN_MESSAGE_TYPE: '未知消息类型',
      NOT_PARTICIPANT: '请先加入房间',
      UNAUTHORIZED: '未授权',
      CONNECTION_FAILED: '连接失败'
    };

    return messages[code] || '未知错误';
  }
}
```

#### 页面错误显示

```xml
<!-- pages/chat-room/index.wxml -->
<view class="error-banner" wx:if="{{errorType}}">
  <text class="error-icon">⚠️</text>
  <text class="error-text">{{errorMessage}}</text>
</view>
```

```typescript
// pages/chat-room/index.ts
Page({
  data: {
    errorType: '',
    errorMessage: ''
  },

  // 清除错误状态
  clearError() {
    this.setData({
      errorType: '',
      errorMessage: ''
    });
  }
});
```

---

## 错误日志

### 服务器日志

```typescript
// 记录所有错误
console.error(`[Error] ${code}: ${message}`, {
  connectionId,
  userId,
  roomId,
  context,
  timestamp: new Date().toISOString()
});
```

### 客户端日志

```typescript
// 上报错误到监控系统（可选）
wx.reportAnalytics('ws_error', {
  code,
  message,
  page: currentPage.route,
  timestamp: Date.now()
});
```

---

## 常见问题

### Q1: 如何区分 HTTP 错误和 WebSocket 错误？

- **HTTP 错误**: 状态码 + JSON 响应体
- **WebSocket 错误**: `type: "ERROR"` 消息

### Q2: 错误消息需要国际化吗？

当前版本仅支持中文。未来可以根据客户端语言返回不同消息。

### Q3: 错误上下文（context）包含什么？

可选字段，包含帮助调试的额外信息，例如 roomCode, userId 等。

### Q4: 如何测试错误场景？

可以编写单元测试或使用 Postman 模拟错误请求。

---

## 错误码速查表

### HTTP

| 错误码 | 状态码 | 描述 |
|--------|--------|------|
| `INVALID_REQUEST` | 400 | 请求参数无效 |
| `ROOM_CREATE_FAILED` | 500 | 创建房间失败 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 |

### WebSocket

| 错误码 | 场景 | 描述 |
|--------|------|------|
| `ROOM_NOT_FOUND` | 加入房间 | 房间代码不存在 |
| `ROOM_FULL` | 加入房间 | 房间已满（2人） |
| `ROOM_CLOSED` | 加入房间 | 房间已关闭 |
| `ROOM_NOT_READY` | 发送消息 | 房间未就绪 |
| `ALREADY_JOINED` | 加入房间 | 用户已在房间 |
| `INVALID_PAYLOAD` | 所有消息 | 消息格式错误 |
| `MESSAGE_SEND_FAILED` | 发送消息 | 发送失败 |
| `UNKNOWN_MESSAGE_TYPE` | 所有消息 | 未知消息类型 |
| `NOT_PARTICIPANT` | 发送消息 | 用户不是参与者 |

---

## 下一步

了解错误处理后，推荐阅读：
- [创建房间](01-room-creation.md) - HTTP 错误示例
- [加入房间](02-join-room.md) - WebSocket 错误示例
- [连接管理](04-connection-lifecycle.md) - 连接错误处理

---

**相关文档**:
- [返回文档首页](../README.md)
- [数据模型](../data-models.md)
- [产品需求](../product-requirements.md)
