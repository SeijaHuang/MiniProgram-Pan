# WebSocket 测试指南

本文档提供了多种方式来测试后端 WebSocket 服务。

## 🔧 方法一：Postman (推荐)

### 安装和设置

1. 下载并安装 [Postman](https://www.postman.com/downloads/)
2. 打开 Postman，点击 **Import** 导入 `postman_collection.json`
3. 或者手动创建 WebSocket 请求

### 使用步骤

1. **创建 WebSocket 请求**
   - 点击 **New** → **WebSocket Request**
   - URL: `ws://localhost:8080/ws`
   - 点击 **Connect**

2. **发送消息**
   - 连接成功后，在消息输入框中粘贴以下 JSON
   - 点击 **Send**

### 测试场景

#### 场景 1: 创建房间并准备游戏

**步骤 1 - 玩家1创建房间:**
```json
{
  "type": "room:create",
  "data": {
    "playerName": "玩家1",
    "playerAvatar": "https://example.com/avatar1.png"
  },
  "timestamp": 1737158400000
}
```

**预期响应:**
```json
{
  "type": "room:created",
  "data": {
    "room": {
      "id": "room_1737158400000_abc123",
      "state": "waiting",
      "players": [...]
    },
    "player": {
      "id": "player_1737158400000_xyz789",
      "name": "玩家1"
    }
  },
  "timestamp": 1737158400123
}
```

**步骤 2 - 玩家2加入房间** (需要新的 WebSocket 连接):
```json
{
  "type": "room:join",
  "data": {
    "roomId": "room_1737158400000_abc123",
    "playerName": "玩家2"
  },
  "timestamp": 1737158401000
}
```

**步骤 3 - 玩家准备:**
```json
{
  "type": "player:ready",
  "data": {
    "playerId": "player_1737158400000_xyz789"
  },
  "timestamp": 1737158402000
}
```

**当两个玩家都准备后，会收到游戏开始消息:**
```json
{
  "type": "game:start",
  "data": {
    "room": {...},
    "startingPlayer": "player_1737158400000_xyz789"
  },
  "timestamp": 1737158403000
}
```

#### 场景 2: 游戏对战

```json
{
  "type": "game:move",
  "data": {
    "x": 5,
    "y": 3
  },
  "timestamp": 1737158404000
}
```

#### 场景 3: 心跳测试

```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": 1737158405000
  },
  "timestamp": 1737158405000
}
```

**预期响应:**
```json
{
  "type": "heartbeat_ack",
  "data": {
    "timestamp": 1737158405000,
    "serverTime": 1737158405123
  },
  "timestamp": 1737158405123
}
```

---

## 🌐 方法二：浏览器开发者工具

打开浏览器 Console (F12)，复制以下代码：

```javascript
// 连接 WebSocket
const ws = new WebSocket('ws://localhost:8080/ws');

// 监听连接打开
ws.onopen = () => {
  console.log('✅ 已连接');
  
  // 创建房间
  ws.send(JSON.stringify({
    type: 'room:create',
    data: {
      playerName: '浏览器测试玩家',
      playerAvatar: 'https://example.com/avatar.png'
    },
    timestamp: Date.now()
  }));
};

// 监听消息
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('📩 收到消息:', message.type);
  console.table(message);
};

// 监听错误
ws.onerror = (error) => {
  console.error('❌ 错误:', error);
};

// 监听关闭
ws.onclose = () => {
  console.log('👋 连接已关闭');
};

// 发送自定义消息的辅助函数
function sendMessage(type, data) {
  ws.send(JSON.stringify({
    type,
    data,
    timestamp: Date.now()
  }));
}

// 使用示例:
// sendMessage('heartbeat', { timestamp: Date.now() });
```

---

## 🖥️ 方法三：使用测试脚本

```bash
cd backend
npm run ws:test
```

输出示例:
```
🚀 Starting WebSocket Test...
📡 Connecting to ws://localhost:8080/ws

✅ Connected to WebSocket server

📤 Test 1: Creating room...
📩 Received: welcome
{
  "type": "welcome",
  "data": {
    "clientId": "client_1737158400000_abc123",
    "serverTime": 1737158400123
  },
  "timestamp": 1737158400123
}
---

📩 Received: room:created
{
  "type": "room:created",
  "data": {
    "room": {...},
    "player": {...}
  },
  "timestamp": 1737158400456
}
---
```

---

## 🔍 方法四：VS Code REST Client 扩展

1. 安装扩展: **REST Client** (Huachao Mao)
2. 创建文件 `test.http`:

```http
### WebSocket Connection
CONNECT ws://localhost:8080/ws

### Create Room
{
  "type": "room:create",
  "data": {
    "playerName": "VS Code Test"
  },
  "timestamp": {{$timestamp}}
}

### Heartbeat
{
  "type": "heartbeat",
  "data": {
    "timestamp": {{$timestamp}}
  },
  "timestamp": {{$timestamp}}
}
```

3. 点击 **Send Request**

---

## 📊 常见测试场景

### 测试 1: 完整游戏流程

1. 玩家1创建房间 → 获得 `roomId` 和 `playerId`
2. 玩家2加入房间 (使用 `roomId`)
3. 玩家1准备
4. 玩家2准备 → 游戏自动开始
5. 轮流发送 `game:move` 消息
6. 服务器广播 `game:update` 给所有玩家

### 测试 2: 错误处理

发送无效消息类型:
```json
{
  "type": "invalid:message",
  "data": {},
  "timestamp": 1737158400000
}
```

预期响应:
```json
{
  "type": "error",
  "data": {
    "code": "UNKNOWN_MESSAGE_TYPE",
    "message": "Unknown message type: invalid:message"
  },
  "timestamp": 1737158400123
}
```

### 测试 3: 断线重连

1. 连接 WebSocket
2. 创建/加入房间
3. 手动关闭连接
4. 重新连接
5. 检查服务器是否正确处理断开的玩家

---

## 🐛 调试技巧

### 查看 WebSocket 流量 (Chrome DevTools)

1. 打开 Chrome 开发者工具 (F12)
2. 切换到 **Network** 标签页
3. 过滤器选择 **WS** (WebSocket)
4. 刷新页面或建立 WebSocket 连接
5. 点击连接查看详细的消息收发记录

### 使用 Postman Console

在 Postman 底部打开 **Console**，可以看到完整的请求/响应日志。

### 后端日志

服务器会输出详细日志:
```
Client connected: client_xxx (Total: 1)
Received message from client_xxx: room:create
Room created: room_yyy by player: Test Player
```

---

## ⚠️ 注意事项

1. **时间戳**: 消息中的 `timestamp` 字段应使用毫秒级时间戳
2. **连接数**: 测试多玩家场景时需要打开多个 WebSocket 连接
3. **房间ID**: 创建房间后保存 `roomId`，其他玩家加入时需要使用
4. **玩家ID**: 某些操作(如准备)需要提供正确的 `playerId`
5. **顺序**: 游戏开始前必须有2个玩家，且都处于准备状态

---

## 📖 参考文档

- [WebSocket API 文档](../README.md#websocket-消息协议)
- [Postman WebSocket 教程](https://learning.postman.com/docs/sending-requests/websocket/websocket/)
- [Chrome DevTools Network](https://developer.chrome.com/docs/devtools/network/)
