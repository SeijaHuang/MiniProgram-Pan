# 功能文档：ASR 实时语音转文字

## 概述

ASR（Automatic Speech Recognition）模块为 Chat Room 的发言舞台提供实时语音转文字能力，将发言者的语音内容实时转换为文本并展示。

**协议**: WebSocket 实时通信 + 腾讯云 ASR WebSocket
**服务商**: 腾讯云实时语音识别
**目标**: 边说边出字的实时体验

---

## 功能定位

ASR 模块不是独立功能，而是：

> **发言舞台区域「语音反馈」的技术实现方式**

其输出文本将同时作为：
- 对方用户的理解辅助
- 后续 AI 判决模块的输入来源（未来扩展）

---

## 设计原则

- **实时优先**: 体验优先于识别准确率
- **舞台中心化**: 文本只出现在发言舞台
- **弱存在感**: ASR 本身不引入新按钮或提示
- **失败可容忍**: ASR 失败不阻断主流程

---

## 业务流程

### 状态机

```
IDLE → ACTIVE → STOPPED
  ↑       ↑        ↑
未开始  录音中   已结束
```

### 详细流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        ASR 会话流程                               │
├─────────────────────────────────────────────────────────────────┤
│  用户按下麦克风按钮                                                │
│       ↓                                                          │
│  客户端发送 ASR_START（创建会话）                                  │
│       ↓                                                          │
│  服务器创建 ASR Session 并连接腾讯云                               │
│       ↓                                                          │
│  客户端持续发送 ASR_AUDIO（音频分片）                              │
│       ↓                                                          │
│  腾讯云返回识别结果（Partial/Final）                               │
│       ↓                                                          │
│  服务器转换并广播 ASR_TEXT                                         │
│       ↓                                                          │
│  用户松开麦克风或倒计时结束                                         │
│       ↓                                                          │
│  客户端发送 ASR_STOP                                              │
│       ↓                                                          │
│  服务器关闭 ASR Session 并清理资源                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 会话生命周期

```
T+0s    : 用户按下麦克风，发送 ASR_START
T+0.1s  : 服务器创建会话，连接腾讯云
T+0.5s~ : 持续发送 ASR_AUDIO（音频帧）
T+0.5s~ : 持续接收 ASR_TEXT（Partial 文本）
T+Ns    : 用户松开麦克风，发送 ASR_STOP
T+N+0.1s: 接收最后的 ASR_TEXT（Final 文本）
T+N+0.2s: 会话销毁
```

---

## 触发与结束条件

### 启动条件（ASR_START）

ASR 会话仅在以下条件同时满足时启动：

1. 当前用户是 **发言方**
2. 用户按下麦克风按钮
3. 当前倒计时尚未结束

### 结束条件（ASR_STOP）

ASR 会话在以下任一条件触发时结束：

- 用户松开麦克风
- 倒计时归零（强制结束）
- 发言方网络断开
- ASR 服务异常（自动结束）

---

## WebSocket 消息规格

### 消息类型枚举

```typescript
enum EWSMessageType {
    AsrStart = 'ASR_START',     // 客户端 → 服务器：开始 ASR 会话
    AsrAudio = 'ASR_AUDIO',     // 客户端 → 服务器：发送音频分片
    AsrStop = 'ASR_STOP',       // 客户端 → 服务器：结束 ASR 会话
    AsrText = 'ASR_TEXT',       // 服务器 → 客户端：识别文本（广播）
}
```

---

### ASR_START（客户端 → 服务器）

**触发时机**: 用户按下麦克风按钮时发送

**用途**:
- 创建 ASR Session
- 初始化与腾讯云的连接

**消息格式**:
```typescript
interface IAsrStartMessage {
    type: 'ASR_START';
    data: {
        roomId: string;
        speakerId: string;      // 发言者 userId
        sessionId: string;      // 客户端生成的会话 ID（UUID）
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "ASR_START",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "speakerId": "user-123",
        "sessionId": "session-abc-def-ghi"
    },
    "timestamp": 1737849600000
}
```

**幂等性**: 重复 START 会被忽略（基于 sessionId）

---

### ASR_AUDIO（客户端 → 服务器）

**触发时机**: 录音过程中持续发送（建议 100-200ms 间隔）

**用途**: 发送音频数据流给腾讯云 ASR

**消息格式**:
```typescript
interface IAsrAudioMessage {
    type: 'ASR_AUDIO';
    data: {
        roomId: string;
        sessionId: string;      // 会话 ID（用于关联）
        seq: number;            // 音频帧序号（从 1 开始）
        audio: string;          // Base64 编码的音频数据
        format: 'pcm' | 'opus'; // 音频格式
        sampleRate: number;     // 采样率（Hz）
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "ASR_AUDIO",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "sessionId": "session-abc-def-ghi",
        "seq": 42,
        "audio": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA...",
        "format": "pcm",
        "sampleRate": 16000
    },
    "timestamp": 1737849602345
}
```

**音频规范**:
- **格式**: PCM 16位单声道 / Opus
- **采样率**: 16000 Hz（推荐）
- **分片大小**: 建议 3.2KB（对应 100ms 的 PCM）
- **序号**: 单调递增，用于检测乱序和重复

**幂等性**: 
- `seq ≤ lastSeq` 的帧会被丢弃
- 会话已结束的音频会被丢弃

---

### ASR_STOP（客户端 → 服务器）

**触发时机**: 用户松开麦克风或倒计时结束时发送

**用途**: 结束 ASR 会话并获取最终识别结果

**消息格式**:
```typescript
interface IAsrStopMessage {
    type: 'ASR_STOP';
    data: {
        roomId: string;
        sessionId: string;      // 会话 ID
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "ASR_STOP",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "sessionId": "session-abc-def-ghi"
    },
    "timestamp": 1737849610000
}
```

**幂等性**: 重复 STOP 会被忽略

---

### ASR_TEXT（服务器 → 客户端）

**触发时机**: 
- 腾讯云返回识别结果时（实时）
- 每次文本更新都会广播

**用途**: 广播识别文本给房间内所有用户

**消息格式**:
```typescript
interface IAsrTextMessage {
    type: 'ASR_TEXT';
    data: {
        roomId: string;
        speakerId: string;      // 发言者 userId
        sessionId: string;      // 会话 ID
        isFinal: boolean;       // false=实时文本（可覆盖），true=最终文本（固化）
        text: string;           // 识别文本
        confidence: number;     // 置信度（0-1）
    };
    timestamp: number;
}
```

**示例（Partial）**:
```json
{
    "type": "ASR_TEXT",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "speakerId": "user-123",
        "sessionId": "session-abc-def-ghi",
        "isFinal": false,
        "text": "我觉得你刚才…",
        "confidence": 0.63
    },
    "timestamp": 1737849602500
}
```

**示例（Final）**:
```json
{
    "type": "ASR_TEXT",
    "data": {
        "roomId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "speakerId": "user-123",
        "sessionId": "session-abc-def-ghi",
        "isFinal": true,
        "text": "我觉得你刚才说的不对",
        "confidence": 0.89
    },
    "timestamp": 1737849610200
}
```

**文本覆盖规则**:
- 新的 Partial 覆盖旧 Partial
- Final 出现后，文本固定，不再接受 Partial 更新
- 同一轮发言只存在一个实时文本块

---

## 数据模型

### ASR 会话状态

```typescript
enum EAsrSessionStatus {
    Active = 'ACTIVE',      // 会话进行中
    Stopped = 'STOPPED',    // 已停止
    Error = 'ERROR',        // 异常结束
}
```

### ASR 会话信息

```typescript
interface IAsrSession {
    sessionId: string;          // 会话 ID
    roomId: string;             // 房间 ID
    speakerId: string;          // 发言者 userId
    status: EAsrSessionStatus;  // 会话状态
    startedAt: number;          // 开始时间戳
    lastAudioSeq: number;       // 最后接收的音频序号
    tencentWsConn?: WebSocket;  // 腾讯云 WebSocket 连接
}
```

### 识别文本类型

```typescript
enum EAsrTextType {
    Partial = 'PARTIAL',    // 实时文本（非稳态）
    Final = 'FINAL',        // 最终文本（稳态）
}
```

---

## 腾讯云 ASR 集成

### 连接参数

```typescript
interface ITencentAsrConfig {
    url: string;            // wss://asr.cloud.tencent.com/asr/v2/{appid}
    appId: string;          // 腾讯云应用 ID
    secretId: string;       // 密钥 ID
    secretKey: string;      // 密钥 Key
    engineType: string;     // 引擎类型（16k_zh: 中文 16k 通用）
}
```

### 腾讯云消息格式

**启动识别**:
```json
{
    "voice_format": 1,
    "seq": 0,
    "voice_id": "session-abc-def-ghi",
    "slice_type": 0
}
```

**发送音频**:
```json
{
    "voice_format": 1,
    "seq": 1,
    "voice_id": "session-abc-def-ghi",
    "slice_type": 1,
    "data": "base64_audio_data"
}
```

**结束识别**:
```json
{
    "voice_format": 1,
    "seq": 99,
    "voice_id": "session-abc-def-ghi",
    "slice_type": 2
}
```

### 腾讯云响应格式

**实时结果（Partial）**:
```json
{
    "code": 0,
    "message": "success",
    "voice_id": "session-abc-def-ghi",
    "message_id": "msg-123",
    "result": {
        "slice_type": 0,
        "index": 1,
        "start_time": 0,
        "end_time": 1200,
        "voice_text_str": "我觉得你刚才",
        "word_list": [...],
        "confidence": 0.63
    },
    "final": 0
}
```

**最终结果（Final）**:
```json
{
    "code": 0,
    "message": "success",
    "voice_id": "session-abc-def-ghi",
    "message_id": "msg-456",
    "result": {
        "slice_type": 2,
        "index": 5,
        "start_time": 0,
        "end_time": 5200,
        "voice_text_str": "我觉得你刚才说的不对",
        "word_list": [...],
        "confidence": 0.89
    },
    "final": 1
}
```

---

## 错误处理

### ASR 错误码

| 错误码 | 场景 | 说明 |
|--------|------|------|
| `INVALID_PAYLOAD` | 消息格式错误 | 检查必填字段 |
| `ROOM_NOT_FOUND` | 房间不存在 | 房间可能已关闭 |
| `NOT_PARTICIPANT` | 非房间成员 | 用户不在此房间 |
| `SESSION_NOT_FOUND` | 会话不存在 | sessionId 无效或已结束 |
| `ASR_SERVICE_ERROR` | ASR 服务异常 | 腾讯云连接失败 |
| `AUDIO_FORMAT_ERROR` | 音频格式错误 | 不支持的音频格式 |

### 错误响应格式

```json
{
    "type": "ERROR",
    "data": {
        "code": "ASR_SERVICE_ERROR",
        "message": "ASR service connection failed",
        "context": {
            "sessionId": "session-abc-def-ghi"
        }
    },
    "timestamp": 1737849605000
}
```

### 异常场景处理

| 场景 | 系统行为 | 用户感知 |
|------|----------|----------|
| ASR 服务中断 | 强制结束会话，发送 ERROR | 显示「（未识别到有效内容）」 |
| 长时间无音频 | 自动 STOP（30s 超时） | 自动结束识别 |
| 网络抖动 | 尝试完成当前会话 | 可能有延迟 |
| 无有效语音 | 返回空 Final 文本 | 显示「（未识别到有效内容）」 |
| 音频帧乱序 | 丢弃 seq ≤ lastSeq 的帧 | 可能影响识别质量 |

**对主流程的影响**:
- ✅ ASR 异常不会阻断发言流程
- ✅ 不影响倒计时、轮换、判决阶段
- ✅ 只影响文本展示

---

## 后端实现

### 代码路径

```
backend/src/
├── constants/
│   └── config.ts                    # ASR 配置常量
├── types/websocket/
│   ├── base.ts                      # 基础类型定义
│   └── asr.ts                       # ASR 消息类型定义
├── models/schemas/
│   └── asr-message.schema.ts        # Zod 验证 Schema
├── controllers/
│   └── ws-controller.ts             # WebSocket 路由控制
├── services/
│   ├── handlers/
│   │   ├── asr-start-handler.ts     # ASR_START 处理
│   │   ├── asr-audio-handler.ts     # ASR_AUDIO 处理
│   │   └── asr-stop-handler.ts      # ASR_STOP 处理
│   └── websocket/
│       └── asr-manager.ts           # ASR 会话管理（单例）
└── integrations/
    └── tencent-asr-client.ts        # 腾讯云 ASR 客户端
```

### 架构分层

```
┌─────────────────────────────────────────────┐
│             ws-controller.ts                │  ← 路由层：消息分发、响应格式化
├─────────────────────────────────────────────┤
│           asr-*-handler.ts                  │  ← 业务层：验证、业务逻辑
├─────────────────────────────────────────────┤
│            asr-manager.ts                   │  ← 领域层：会话管理、状态维护
├─────────────────────────────────────────────┤
│        tencent-asr-client.ts                │  ← 集成层：腾讯云 ASR SDK 封装
└─────────────────────────────────────────────┘
```

### 核心代码示例

#### 1. ASR 会话管理器 (asr-manager.ts)

```typescript
class AsrManager {
    private sessions: Map<string, IAsrSession> = new Map();

    /**
     * 创建 ASR 会话（幂等）
     */
    createSession(roomId: string, speakerId: string, sessionId: string): IAsrSession | null {
        // 幂等性检查
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId)!;
        }

        // 创建会话
        const session: IAsrSession = {
            sessionId,
            roomId,
            speakerId,
            status: EAsrSessionStatus.Active,
            startedAt: Date.now(),
            lastAudioSeq: 0,
        };

        // 初始化腾讯云连接
        const tencentWs = tencentAsrClient.connect(sessionId, {
            onText: (text: string, isFinal: boolean, confidence: number) => {
                this.handleAsrResult(sessionId, text, isFinal, confidence);
            },
            onError: (error: Error) => {
                this.handleAsrError(sessionId, error);
            },
        });

        session.tencentWsConn = tencentWs;
        this.sessions.set(sessionId, session);

        return session;
    }

    /**
     * 发送音频数据（带幂等性检查）
     */
    sendAudio(sessionId: string, seq: number, audioData: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== EAsrSessionStatus.Active) {
            return false;
        }

        // 幂等性：丢弃乱序或重复的帧
        if (seq <= session.lastAudioSeq) {
            return false;
        }

        // 发送给腾讯云
        tencentAsrClient.sendAudio(session.tencentWsConn!, seq, audioData);
        session.lastAudioSeq = seq;

        return true;
    }

    /**
     * 停止会话（幂等）
     */
    stopSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== EAsrSessionStatus.Active) {
            return;
        }

        // 发送结束信号给腾讯云
        tencentAsrClient.stop(session.tencentWsConn!, sessionId);
        session.status = EAsrSessionStatus.Stopped;

        // 延迟清理（等待最后的 Final 结果）
        setTimeout(() => {
            this.cleanupSession(sessionId);
        }, 5000);
    }

    /**
     * 处理 ASR 结果并广播
     */
    private handleAsrResult(
        sessionId: string, 
        text: string, 
        isFinal: boolean, 
        confidence: number
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // 广播给房间内所有用户
        connectionManager.broadcastToRoom(session.roomId, {
            type: EWSMessageType.AsrText,
            data: {
                roomId: session.roomId,
                speakerId: session.speakerId,
                sessionId,
                isFinal,
                text,
                confidence,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * 清理会话资源
     */
    private cleanupSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // 关闭腾讯云连接
        if (session.tencentWsConn) {
            tencentAsrClient.disconnect(session.tencentWsConn);
        }

        // 删除会话
        this.sessions.delete(sessionId);
    }
}

export const asrManager = new AsrManager();
```

#### 2. ASR_START 处理器 (asr-start-handler.ts)

```typescript
export function handleAsrStart(message: IAsrStartMessage): TAsrStartHandlerResult {
    // 验证消息格式
    const validation = AsrStartDataSchema.safeParse(message.data);
    if (!validation.success) {
        return { 
            success: false, 
            code: EWSErrorCode.InvalidPayload, 
            message: 'Invalid ASR_START payload' 
        };
    }

    const { roomId, speakerId, sessionId } = validation.data;

    // 检查房间存在
    const room = roomManager.getRoomById(roomId);
    if (!room) {
        return { 
            success: false, 
            code: EWSErrorCode.RoomNotFound, 
            message: 'Room not found' 
        };
    }

    // 检查用户是房间成员
    const isParticipant = room.participants.some(p => p.userId === speakerId);
    if (!isParticipant) {
        return { 
            success: false, 
            code: EWSErrorCode.NotParticipant, 
            message: 'User is not in room' 
        };
    }

    // 创建会话（幂等）
    const session = asrManager.createSession(roomId, speakerId, sessionId);
    if (!session) {
        return { 
            success: false, 
            code: EWSErrorCode.AsrServiceError, 
            message: 'Failed to create ASR session' 
        };
    }

    return { 
        success: true, 
        sessionId 
    };
}
```

#### 3. ASR_AUDIO 处理器 (asr-audio-handler.ts)

```typescript
export function handleAsrAudio(message: IAsrAudioMessage): TAsrAudioHandlerResult {
    // 验证消息格式
    const validation = AsrAudioDataSchema.safeParse(message.data);
    if (!validation.success) {
        return { 
            success: false, 
            code: EWSErrorCode.InvalidPayload, 
            message: 'Invalid ASR_AUDIO payload' 
        };
    }

    const { sessionId, seq, audio } = validation.data;

    // 发送音频（带幂等性检查）
    const sent = asrManager.sendAudio(sessionId, seq, audio);
    if (!sent) {
        // 会话不存在或帧重复，静默忽略
        return { 
            success: false, 
            code: EWSErrorCode.SessionNotFound, 
            message: 'Invalid session or duplicate audio frame' 
        };
    }

    return { success: true };
}
```

---

## 配置项

```typescript
// backend/src/constants/config.ts

export const ASR_CONFIG = {
    /** 腾讯云 ASR AppId */
    TENCENT_APP_ID: process.env.TENCENT_ASR_APP_ID || '',
    
    /** 腾讯云 ASR SecretId */
    TENCENT_SECRET_ID: process.env.TENCENT_ASR_SECRET_ID || '',
    
    /** 腾讯云 ASR SecretKey */
    TENCENT_SECRET_KEY: process.env.TENCENT_ASR_SECRET_KEY || '',
    
    /** 引擎类型 */
    ENGINE_TYPE: '16k_zh',
    
    /** 音频格式（1: PCM, 4: Opus） */
    VOICE_FORMAT: 1,
    
    /** 会话超时时间（无音频时自动停止，ms） */
    SESSION_TIMEOUT_MS: 30000,
    
    /** 会话清理延迟（停止后保留以接收 Final 结果，ms） */
    CLEANUP_DELAY_MS: 5000,
} as const;
```

---

## 消息序列图

```
┌────────┐          ┌────────┐          ┌────────┐          ┌─────────┐
│ Client │          │ Server │          │ Client │          │ Tencent │
│ (发言者)│          │        │          │ (听众) │          │   ASR   │
└───┬────┘          └───┬────┘          └───┬────┘          └────┬────┘
    │                   │                   │                    │
    │  按下麦克风         │                   │                    │
    │                   │                   │                    │
    │───ASR_START──────>│                   │                    │
    │                   │                   │                    │
    │                   │───Connect────────────────────────────>│
    │                   │                   │                    │
    │───ASR_AUDIO (1)──>│                   │                    │
    │                   │───Send Audio─────────────────────────>│
    │                   │                   │                    │
    │───ASR_AUDIO (2)──>│                   │                    │
    │                   │───Send Audio─────────────────────────>│
    │                   │                   │                    │
    │                   │<──Partial Result──────────────────────│
    │<──ASR_TEXT────────│───ASR_TEXT───────>│                    │
    │   (isFinal=false) │   (广播)          │                    │
    │                   │                   │                    │
    │───ASR_AUDIO (3)──>│                   │                    │
    │                   │───Send Audio─────────────────────────>│
    │                   │                   │                    │
    │                   │<──Partial Result──────────────────────│
    │<──ASR_TEXT────────│───ASR_TEXT───────>│                    │
    │   (覆盖上一条)     │                   │                    │
    │                   │                   │                    │
    │  松开麦克风         │                   │                    │
    │                   │                   │                    │
    │───ASR_STOP───────>│                   │                    │
    │                   │───Stop───────────────────────────────>│
    │                   │                   │                    │
    │                   │<──Final Result────────────────────────│
    │<──ASR_TEXT────────│───ASR_TEXT───────>│                    │
    │   (isFinal=true)  │   (最终文本)       │                    │
    │                   │                   │                    │
    │                   │───Disconnect─────────────────────────>│
    │                   │                   │                    │
```

---

## 幂等性设计

### 目标

避免以下问题：
- 重复 START 创建多条 ASR 连接
- STOP 被触发多次
- 音频帧重复或乱序
- 会话泄露（资源未释放）

### 幂等规则

| 场景 | 处理策略 |
|------|----------|
| ASR_START 重复（相同 sessionId） | 忽略，返回现有会话 |
| ASR_STOP 重复 | 忽略，静默成功 |
| 音频 seq ≤ lastSeq | 丢弃此帧，不发送给腾讯云 |
| 会话已结束仍发音频 | 丢弃，不报错 |
| 会话超时（30s 无音频） | 自动 STOP 并清理 |
| STOP 后 5s 未收到 Final | 强制清理会话 |

### 内存安全

```typescript
// 会话管理器内存限制
class AsrManager {
    private readonly MAX_SESSIONS = 100;

    createSession(...): IAsrSession | null {
        // 防止内存溢出
        if (this.sessions.size >= this.MAX_SESSIONS) {
            // 清理最老的 10% 会话
            this.cleanupOldestSessions(10);
        }
        // ...
    }
}
```

---

## 性能指标

| 指标 | 目标值 |
|------|--------|
| 首字延迟 | < 500ms |
| 文本更新频率 | 200-500ms |
| 音频分片大小 | 3.2KB (100ms PCM) |
| 内存占用（每会话） | < 10KB |
| 并发会话数 | 最多 100 个 |

---

## 测试用例

### WebSocket 测试

```bash
# 连接 WebSocket
wscat -c ws://localhost:8080/ws

# 1. 开始会话
{"type":"ASR_START","data":{"roomId":"test-room","speakerId":"user-123","sessionId":"session-001"}}

# 2. 发送音频（需要 Base64 编码的音频数据）
{"type":"ASR_AUDIO","data":{"roomId":"test-room","sessionId":"session-001","seq":1,"audio":"UklGRiQAAAB...","format":"pcm","sampleRate":16000}}

# 3. 停止会话
{"type":"ASR_STOP","data":{"roomId":"test-room","sessionId":"session-001"}}
```

### 单元测试场景

| 测试场景 | 预期结果 |
|----------|----------|
| 正常流程 | START → AUDIO x N → STOP → 收到 Final 文本 |
| 重复 START | 忽略，返回现有会话 |
| 音频帧乱序 | 丢弃 seq ≤ lastSeq 的帧 |
| 会话不存在时发 AUDIO | 静默忽略 |
| 重复 STOP | 静默忽略 |
| 会话超时 | 自动 STOP 并清理 |
| ASR 服务异常 | 发送 ERROR，不影响主流程 |
| 无有效语音 | 返回空 Final 文本 |

---

## 常见问题

### Q1: 为什么需要 sessionId？

客户端生成 sessionId 用于幂等性控制和会话关联，避免重复创建连接。

### Q2: Partial 和 Final 的区别是什么？

- **Partial**: 实时识别的中间结果，会不断更新覆盖
- **Final**: 最终确认的文本，不再变化，可用于后续分析

### Q3: ASR 失败会影响发言吗？

不会。ASR 失败只影响文本展示，不会阻断录音、倒计时等主流程。

### Q4: 音频分片应该多大？

建议 100ms 的 PCM 数据（约 3.2KB），平衡实时性和网络开销。

### Q5: 如何处理网络抖动？

- 客户端应实现音频缓冲和重传机制
- 服务器通过 seq 序号检测丢失的帧
- 短暂丢帧不影响整体识别质量

---

## 环境变量

```bash
# .env
TENCENT_ASR_APP_ID=1234567890
TENCENT_ASR_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxxx
TENCENT_ASR_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 下一步

ASR 功能完成后，推荐阅读：
- [聊天消息](03-chat-messaging.md) - Chat Room 的消息流程
- [连接管理](04-connection-lifecycle.md) - WebSocket 连接生命周期
- [错误处理](05-error-handling.md) - 完整错误码参考

---

**相关文档**:
- [加入房间](02-join-room.md)
- [震天鼓游戏](06-drum-game.md)
- [数据模型](../data-models.md)
- [API 规格](../api-specification.md)
