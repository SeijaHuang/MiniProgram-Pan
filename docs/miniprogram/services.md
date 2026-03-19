# 服务层说明（miniprogram/services）

本文件描述小程序前端 `miniprogram/services` 目录下的业务服务层职责与接口，
用于页面逻辑与实时通信/HTTP 的解耦与复用。

## 总览

- **Nickname Service**（`nickname-service.ts`）: 用户身份（userId / nickName）持久化管理
- **WebSocket Manager**（`websocket-manager.ts`）: WebSocket 连接生命周期
- **Room Service**（`room-service.ts`）: HTTP 创建房间
- **Room WebSocket Service**（`room-websocket-service.ts`）: 加入房间与 JOIN_ACK
- **Chat Service**（`chat-service.ts`）: 文本消息发送与 CHAT_RECEIVE
- **Drum Service**（`drum-service.ts`）: 鼓点消息发送与对抗结果
- **ASR Service**（`asr-service.ts`）: ASR 语音识别文本同步
- **STS Service**（`sts-service.ts`）: 腾讯云 STS 临时凭证获取
- **Verdict Service**（`verdict-service.ts`）: AI 判决结果获取与缓存
- **Post Game Service**（`post-game-service.ts`）: 赛后互动（特效、共同退堂）

## Nickname Service

**文件**: `miniprogram/services/nickname-service.ts`

**职责**:

- 读取/生成 `userId`（持久化到 Storage）
- 读取/保存用户昵称 `nickName`（持久化到 Storage + globalData）
- 校验昵称有效性（非空、非纯空白、不超过 12 字）

**核心方法**:

- `getUserId(): string`: 返回 globalData 中的 userId；若为空则读 Storage；若仍为空则生成并持久化
- `getNickName(): string`: 返回 globalData 中的 nickName；若为空则读 Storage `userNickName`；若仍为空则返回默认值 `'申冤人'`
- `saveNickName(name: string): void`: 写入 globalData.userInfo.nickName 并同步到 Storage
- `validate(name: string): boolean`: 校验昵称（trim 后非空 + 长度 ≤ 12）

**Storage 键名**:

| 键名           | 说明             |
| -------------- | ---------------- |
| `userId`       | 用户唯一 ID      |
| `userNickName` | 用户昵称（持久） |

**导出**:

```typescript
export const DEFAULT_NICK_NAME = '申冤人';
export const nicknameService = new NicknameService();
```

**使用方**:

- `pages/welcome/index.ts`: `onLoad` 初始化 ID；昵称弹窗保存时调用 `saveNickName`
- `packageA/pages/waiting-room/index.ts`: `initUser()` 调用 `getUserId()` + `getNickName()`

---

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

- `createRoom(): Promise<IRoom>`：调用 `POST /v1/rooms`，
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

- 批量发送鼓点点击（节流 150ms）
- 解析并分发鼓点消息与对抗结果
- 消息队列机制处理页面跳转期间的消息
- 时间同步支持（传递原始接收时间）

**核心方法**:

- `startListening()`: 提前监听消息（在 waiting-room 调用）
- `initialize(options: IDrumServiceOptions)`: 设置回调并处理队列
- `sendStartRequest(userId)`: 发送 DRUM_START_REQUEST（玩家点击「开始游戏」时调用）
- `queueTap()`: 点击入队（节流批量发送）
- `flushPendingTaps()`: 立即发送积压点击
- `cleanup()`: 清理计时器与回调

**初始化选项** (`IDrumServiceOptions`):

```typescript
interface IDrumServiceOptions {
    roomId: string;
    selfRole: EPlayerRole;
    onReady: (
        serverTimeMs,
        hostRole,
        organizerName,
        joinerName,
        receivedAtMs
    ) => void;
    onPlayerReady: (readyCount: number) => void;
    onStart: (startAtMs) => void;
    onTap: (role, delta) => void;
    onFinish: () => void;
    onResult: (winnerRole) => void;
    onError: (message) => void;
}
```

**消息类型**:

- 发送: `DRUM_TAP`, `DRUM_START_REQUEST`
- 接收: `DRUM_READY / DRUM_PLAYER_READY / DRUM_START / DRUM_TAP / DRUM_FINISH / DRUM_RESULT`

**消息队列机制**:

当 handlers 未就绪时（页面跳转期间），`DRUM_READY` 和 `DRUM_START` 消息会被队列，
并记录原始接收时间 `receivedAtMs`。`initialize()` 调用后会处理队列消息，
使用原始接收时间进行时间同步，避免队列延迟影响偏移计算。

## ASR Service

**文件**: `miniprogram/services/asr-service.ts`

**职责**:

- 通过 WebSocket 推送 ASR 语音识别文本
- 节流发送 partial 结果，立即发送 final 结果
- 去重机制防止重复发送相同文本

**核心方法**:

- `initialize(options)`: 注册回调并开始监听
- `pushText(text, isFinal)`: 推送 ASR 识别文本
- `cleanup()`: 清理计时器与回调

## STS Service

**文件**: `miniprogram/services/sts-service.ts`

**职责**:

- 获取腾讯云 STS 临时凭证用于客户端 ASR
- 凭证缓存与自动过期处理

**核心方法**:

- `getCredentials(): Promise<ISTSCredentials>`: 获取 STS 凭证（优先缓存）

## Verdict Service

**文件**: `miniprogram/services/verdict-service.ts`

**职责**:

- WebSocket 监听判决结果推送（主通道）
- HTTP 请求判决结果（回退通道）
- LLM 原始格式 → 前端格式转换
- 缓存判决结果供页面使用
- 管理判决结果生命周期

**核心方法**:

- `startListening(options)`: 注册 WebSocket 监听（`VERDICT_RESULT` / `VERDICT_FAILED`）
- `mapVerdictResult(backend): IVerdictResult`: 转换后端格式为前端格式
- `fetchVerdict(roomId): Promise<IVerdictResult>`: HTTP 回退请求判决
- `cacheResult(result)`: 缓存判决结果
- `getResult(): IVerdictResult | null`: 获取缓存的判决结果
- `clear()`: 清除缓存和 WebSocket 监听

**监听选项**:

```typescript
interface IVerdictListeningOptions {
    onResult: (result: IVerdictResult) => void;
    onError: (payload: IVerdictFailedPayload) => void;
}
```

**数据格式转换**:

| 后端字段                                   | 前端字段                             | 转换说明                  |
| ------------------------------------------ | ------------------------------------ | ------------------------- |
| `radarChart.host/guest`                    | `battleStats.host/guest`             | 字段重命名                |
| `radarChart.*.logicFallacy`                | `battleStats.*.logicSlippery`        | 维度键映射                |
| `radarChart.*.coquettishDamage`            | `battleStats.*.charmAttack`          | 维度键映射                |
| `verdict`                                  | `verdictSummary`                     | 字段重命名                |
| `punishmentTask.role`                      | `punishmentTask.loserId`             | 字段重命名                |
| `responsibility.thirdParty.factors[].name` | `responsibility.thirdParty[].reason` | 字段重命名                |
| `secretReports[]`（数组 + role 字段）      | `secretReports.host/guest`（对象）   | 数组 → 对象               |
| `punishmentTask`（无 deadline 字段）       | `punishmentTask.deadline`            | 固定值 "须在24小时内完成" |

**消息类型**:

- 监听: `VERDICT_RESULT`, `VERDICT_FAILED`
- 发送: `VERDICT_RETRY`（通过 verdict-waiting 页面）
- 回退: `POST /v1/rooms/:roomId/judgments`

## Post Game Service

**文件**: `miniprogram/services/post-game-service.ts`

**职责**:

- 赛后互动消息收发（执行惩戒/跪地求饶）
- 共同退堂请求与确认
- WebSocket 消息监听与分发

**核心方法**:

- `initialize()`: 注册 WebSocket 消息回调（监听 POST_GAME_EFFECT）
- `sendAction(roomId, action, remaining)`: 发送赛后互动动作
- `onEffect(callback)`: 注册特效接收回调
- `destroy()`: 清理回调

**消息类型**:

- 发送: `POST_GAME_ACTION`（execute_punishment / beg_for_mercy）
- 接收: `POST_GAME_EFFECT`

> ⚠️ 注意：共同退堂（`LEAVE_ROOM` / `LEAVE_ROOM_ACK`）由页面直接通过 `wsManager` 处理，不经过 PostGameService。

## 使用约定与注意事项

- **单页面优先**: 每个页面只初始化它需要的 Service。
- **回调覆盖**: `updateCallbacks` 会合并回调，但 `onMessage` 只能由
  当前活跃的服务接管，避免多个服务并行处理同一连接消息。
- **生命周期**: 推荐在 `onLoad` 或初始化时注册回调，在 `onUnload`
  或离开页面时清理（如 `drumService.cleanup()`）。
