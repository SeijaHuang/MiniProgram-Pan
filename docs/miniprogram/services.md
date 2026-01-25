# 服务层说明（miniprogram/services）

本文件描述小程序前端 `miniprogram/services` 目录下的业务服务层职责与接口，
用于页面逻辑与实时通信/HTTP 的解耦与复用。

## 总览

- **WebSocket Manager**（`websocket-manager.ts`）: WebSocket 连接生命周期
- **Room Service**（`room-service.ts`）: HTTP 创建房间
- **Room WebSocket Service**（`room-websocket-service.ts`）: 加入房间与 JOIN_ACK
- **Chat Service**（`chat-service.ts`）: 文本消息发送与 CHAT_RECEIVE
- **Drum Service**（`drum-service.ts`）: 鼓点消息发送与对抗结果

## WebSocket Manager

**文件**: `miniprogram/services/websocket-manager.ts`

**职责**:

- 维护 WebSocket 连接状态（连接/断开/重连）
- 心跳与自动重连机制
- 统一的消息发送与事件回调入口

**核心方法**:

- `connect(callbacks)`: 发起连接并注册回调
- `disconnect()`: 断开连接并停止重连/心跳
- `send(message)`: 发送序列化后的消息对象
- `updateCallbacks(callbacks)`: 合并更新回调
- `isConnected() / getState()`: 查询连接状态

**回调说明**:

`IWebSocketManagerCallbacks` 支持 `onMessage/onConnect/onDisconnect/onError`。
服务层会通过 `updateCallbacks` 注册各自的处理逻辑。

## Room Service（HTTP）

**文件**: `miniprogram/services/room-service.ts`

**职责**:

- 通过 HTTP 创建房间
- 解析创建房间的响应

**核心方法**:

- `createRoom(): Promise<IRoom>`：调用 `POST /room/create`，
  返回创建成功的房间信息

## Room WebSocket Service

**文件**: `miniprogram/services/room-websocket-service.ts`

**职责**:

- 发送 `JOIN_ROOM` 加入房间
- 处理 `JOIN_ACK` 并回传完整房间状态
- 记录当前房间码与用户信息（用于断线重连后自动加入）

**核心方法**:

- `initialize(onJoinAck)`: 注册 JOIN_ACK 回调
- `joinRoom(roomCode, user)`: 发送加入房间消息
- `clear()`: 清理房间缓存
- `getCurrentRoomCode()`: 获取当前 roomCode

## Chat Service

**文件**: `miniprogram/services/chat-service.ts`

**职责**:

- 发送文本消息（`CHAT_SEND`）
- 解析并分发 `CHAT_RECEIVE` 消息
- 处理错误消息 `ERROR`

**核心方法**:

- `initialize(onChatReceive, onError)`: 注册消息与错误回调
- `sendTextMessage(text)`: 发送文本消息

**消息类型**:

- 发送: `CHAT_SEND`
- 接收: `CHAT_RECEIVE`
- 错误: `ERROR`

## Drum Service

**文件**: `miniprogram/services/drum-service.ts`

**职责**:

- 批量发送鼓点点击（节流）
- 解析并分发鼓点消息与对抗结果
- 处理对手离开事件

**核心方法**:

- `initialize(roomId, selfRole, onTap, onResult, onPeerLeft, onError)`
- `queueTap()`: 点击入队（节流批量发送）
- `flushPendingTaps()`: 立即发送积压点击
- `cleanup()`: 清理计时器与回调

**消息类型**:

- 发送: `DRUM_TAP`
- 接收: `DRUM_TAP / DRUM_RESULT / PEER_LEFT`

## 使用约定与注意事项

- **单页面优先**: 每个页面只初始化它需要的 Service。
- **回调覆盖**: `updateCallbacks` 会合并回调，但 `onMessage` 只能由
  当前活跃的服务接管，避免多个服务并行处理同一连接消息。
- **生命周期**: 推荐在 `onLoad` 或初始化时注册回调，在 `onUnload`
  或离开页面时清理（如 `drumService.cleanup()`）。
