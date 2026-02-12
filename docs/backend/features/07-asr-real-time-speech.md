# 功能文档：ASR 实时语音转文字

## 概述

ASR（Automatic Speech Recognition）模块为 Chat Room 的发言舞台提供实时语音转文字能力，将发言者的语音内容实时转换为文本并同步给对方。

**协议**: WebSocket 实时通信
**服务商**: 腾讯云实时语音识别（客户端直连）
**后端职责**: 文本同步、去重、节流、广播
**目标**: 边说边出字的实时体验

---

## 架构设计

### 核心理念

**客户端直连架构**：客户端直接连接腾讯云 ASR 服务，后端只负责文本的同步和广播，不处理音频数据。

### 优势

- ✅ **低延迟**: 客户端直连 ASR，省去服务器中转环节
- ✅ **高可用**: 后端故障不影响语音识别功能
- ✅ **省带宽**: 音频数据不经过后端服务器
- ✅ **易扩展**: 后端只处理轻量级文本同步

### 架构图

```
┌─────────────┐                    ┌──────────────────┐
│   客户端 A   │◄──────WebSocket───►│   后端服务器      │
│  (发言者)    │                    │                  │
└─────────────┘                    │  - 去重 (seq)     │
       │                           │  - 节流 (200ms)   │
       │ 临时凭证                   │  - 广播           │
       ↓                           │                  │
┌─────────────┐                    └──────────────────┘
│ 腾讯云 ASR   │                            │
│  WebSocket  │                            │ ASR_TEXT
└─────────────┘                            │ (广播)
       │                                   ↓
       │ 识别结果                    ┌─────────────┐
       │                            │   客户端 B   │
       └──► 本地显示                 │  (听众)      │
            + ASR_TEXT_PUSH ────────►└─────────────┘
```

---

## 功能定位

ASR 模块不是独立功能，而是：

> **发言舞台区域「语音反馈」的技术实现方式**

其输出文本将同时作为：
- 对方用户的理解辅助
- 本地用户的发言反馈
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
IDLE → RECOGNIZING → SYNCING → IDLE
  ↑        ↑            ↑        ↑
未开始    识别中      同步中    结束
```

### 详细流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        ASR 完整流程                               │
├─────────────────────────────────────────────────────────────────┤
│  用户进入 Chat Room                                               │
│       ↓                                                          │
│  前端调用 GET /v1/tencent/credentials 获取临时凭证                   │
│       ↓                                                          │
│  前端使用临时凭证连接腾讯云 ASR WebSocket                         │
│       ↓                                                          │
│  用户按下麦克风按钮                                               │
│       ↓                                                          │
│  前端开始录音并发送音频到腾讯云 ASR                               │
│       ↓                                                          │
│  腾讯云返回识别结果（Partial/Final）                              │
│       ↓                                                          │
│  前端本地显示识别文本                                             │
│       ↓                                                          │
│  前端通过 ASR_TEXT_PUSH 推送识别结果到后端                        │
│       ↓                                                          │
│  后端验证、去重、节流                                             │
│       ↓                                                          │
│  后端广播 ASR_TEXT 给其他参与者                                   │
│       ↓                                                          │
│  对方客户端接收并显示文本                                         │
│       ↓                                                          │
│  用户松开麦克风或倒计时结束                                       │
│       ↓                                                          │
│  前端停止录音，发送最后的 Final 文本                              │
│       ↓                                                          │
│  会话结束，序列号重置                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 时间线示例

```
T+0s     : 用户按下麦克风，开始录音
T+0.1s   : 腾讯云返回第一个 Partial 结果
T+0.1s   : 前端发送 ASR_TEXT_PUSH (seq: 0, isFinal: false)
T+0.1s   : 后端收到，加入节流队列
T+0.3s   : 节流时间到，后端广播 ASR_TEXT
T+0.4s   : 腾讯云返回新的 Partial 结果
T+0.4s   : 前端发送 ASR_TEXT_PUSH (seq: 1, isFinal: false)
T+0.6s   : 节流时间到，后端广播最新的 ASR_TEXT
...      : 持续更新
T+5s     : 用户松开麦克风
T+5.1s   : 腾讯云返回 Final 结果
T+5.1s   : 前端发送 ASR_TEXT_PUSH (seq: N, isFinal: true)
T+5.1s   : 后端立即广播 Final（不节流）
```

---

## WebSocket 消息规格

### 消息类型枚举

```typescript
enum EWSMessageType {
    AsrTextPush = 'ASR_TEXT_PUSH',  // 客户端 → 服务器：推送识别文本
    AsrText = 'ASR_TEXT',           // 服务器 → 客户端：广播识别文本
}
```

---

### ASR_TEXT_PUSH（客户端 → 服务器）

**触发时机**: 客户端从腾讯云 ASR 收到识别结果后立即发送

**用途**:
- 将本地识别的文本推送到服务器
- 服务器负责广播给其他参与者

**消息格式**:
```typescript
interface IASRTextPushMessage {
    type: 'ASR_TEXT_PUSH';
    data: {
        roomId: string;
        speakerId: string;      // 发言者 userId（必须与连接的 userId 一致）
        seq: number;            // 序列号（从0开始，单调递增）
        text: string;           // 识别的文本内容
        isFinal: boolean;       // false=实时，true=最终
    };
    timestamp: number;
}
```

**字段说明**:
- `roomId`: 当前房间ID
- `speakerId`: 必须与 WebSocket 连接关联的 `userId` 一致
- `seq`: 序列号，用于去重，每次新的录音会话从 0 开始
- `text`: 识别的文本内容
- `isFinal`: 
  - `false`: Partial 文本，实时更新的中间结果
  - `true`: Final 文本，最终确认的结果

**示例**:
```json
{
    "type": "ASR_TEXT_PUSH",
    "data": {
        "roomId": "room_123456",
        "speakerId": "user_alice",
        "seq": 5,
        "text": "我认为这件事情应该这样处理",
        "isFinal": false
    },
    "timestamp": 1738497600000
}
```

**验证规则**:
- ✅ 发言者必须是房间参与者
- ✅ `speakerId` 必须与连接的 `userId` 一致
- ✅ `roomId` 必须与连接的 `roomId` 一致
- ✅ 房间状态必须为 `READY`（2人就位）
- ✅ `seq` 必须单调递增

**错误响应**:
- `ROOM_NOT_FOUND`: 房间不存在
- `NOT_PARTICIPANT`: 用户不是房间参与者
- `ROOM_NOT_READY`: 房间未就绪（未满2人）
- `INVALID_PAYLOAD`: `speakerId` 或 `roomId` 不匹配

---

### ASR_TEXT（服务器 → 客户端）

**触发时机**: 
- Partial: 后端收到 `ASR_TEXT_PUSH` 并完成节流后广播
- Final: 后端收到 Final 的 `ASR_TEXT_PUSH` 后立即广播

**用途**:
- 将发言者的识别文本广播给房间内所有参与者
- 包括发言者自己（用于确认服务器已收到）

**消息格式**:
```typescript
interface IASRTextMessage {
    type: 'ASR_TEXT';
    data: {
        roomId: string;
        speakerId: string;      // 发言者 userId
        seq: number;            // 序列号
        text: string;           // 识别的文本内容
        isFinal: boolean;       // false=实时，true=最终
    };
    timestamp: number;
}
```

**示例**:
```json
{
    "type": "ASR_TEXT",
    "data": {
        "roomId": "room_123456",
        "speakerId": "user_alice",
        "seq": 5,
        "text": "我认为这件事情应该这样处理",
        "isFinal": false
    },
    "timestamp": 1738497600100
}
```

**关键行为**:
- ✅ 广播给房间内**所有参与者**（包括发言者）
- ✅ Partial 消息被节流到 200ms 间隔
- ✅ Final 消息立即广播，不节流
- ✅ 所有客户端接收到相同的文本数据（服务器权威）

---

## 后端核心机制

### 1. 去重 (Deduplication)

**目的**: 防止网络重传或客户端重复发送导致的重复消息

**实现**:
```typescript
// 每个 (roomId, speakerId) 维护一个会话状态
interface IASRSessionState {
    lastSeq: number;              // 最后处理的序列号
    finalReceived: boolean;       // 是否已收到 Final
    pendingPartial: IMessage;     // 待发送的 Partial
    throttleTimer: NodeJS.Timeout | null;
}
```

**规则**:
- `seq <= lastSeq` 的消息会被丢弃
- Final 后的消息会被忽略
- 新的录音会话从 seq: 0 开始

### 2. 节流 (Throttling)

**目的**: 减少网络流量，避免 Partial 消息过于频繁

**实现**:
- **Partial 消息**: 节流到 200ms 间隔
  - 收到 Partial 时，如果没有 timer，启动一个 200ms 的 timer
  - 在 timer 期间收到的 Partial 会更新 `pendingPartial`
  - Timer 到期时发送最新的 `pendingPartial`
- **Final 消息**: 立即发送，不节流
  - 清除待处理的 Partial
  - 立即广播 Final 消息

### 3. 会话管理

**会话生命周期**:
```
创建: 收到第一个 ASR_TEXT_PUSH 时自动创建
活跃: 持续接收并处理消息
结束: 收到 Final 后，100ms 后自动重置
清理: 用户断开连接时清理所有会话
```

**会话隔离**:
- 每个 `(roomId, speakerId)` 对应一个独立会话
- Final 后的旧消息会被忽略
- 新的录音会话会重置序列号

---

## 客户端集成指南

### 1. 获取临时凭证

```typescript
async function getSTSCredentials() {
    const response = await fetch('http://localhost:8080/v1/tencent/credentials');
    const data = await response.json();
    return {
        token: data.Credentials.Token,
        tmpSecretId: data.Credentials.TmpSecretId,
        tmpSecretKey: data.Credentials.TmpSecretKey,
    };
}
```

### 2. 连接腾讯云 ASR

```typescript
const credentials = await getSTSCredentials();
const asrClient = QCloudAIVoice.speechRecognizerManager();

asrClient.init({
    secretId: credentials.tmpSecretId,
    secretKey: credentials.tmpSecretKey,
    token: credentials.token,
});
```

### 3. 处理识别结果

```typescript
let seq = 0;

// 实时识别结果（Partial）
asrClient.OnRecognitionResultChange = (res) => {
    const text = res.result?.voice_text_str;
    if (text) {
        // 本地显示
        updateLocalDisplay(text, false);
        
        // 推送到服务器
        wsManager.send({
            type: 'ASR_TEXT_PUSH',
            data: {
                roomId: currentRoomId,
                speakerId: currentUserId,
                seq: seq++,
                text: text,
                isFinal: false,
            },
            timestamp: Date.now(),
        });
    }
};

// 最终识别结果（Final）
asrClient.OnRecognitionComplete = (res) => {
    const text = res.result?.voice_text_str;
    if (text) {
        // 本地显示
        updateLocalDisplay(text, true);
        
        // 推送到服务器
        wsManager.send({
            type: 'ASR_TEXT_PUSH',
            data: {
                roomId: currentRoomId,
                speakerId: currentUserId,
                seq: seq++,
                text: text,
                isFinal: true,
            },
            timestamp: Date.now(),
        });
        
        // 重置序列号（新的录音会话）
        seq = 0;
    }
};
```

### 4. 接收对方的识别文本

```typescript
wsManager.onMessage((message) => {
    if (message.type === 'ASR_TEXT') {
        const { speakerId, text, isFinal } = message.data;
        
        // 如果是对方的文本
        if (speakerId !== currentUserId) {
            updateOpponentDisplay(text, isFinal);
        }
    }
});
```

---

## 错误处理

### 常见错误场景

| 场景 | 错误代码 | 客户端处理 |
|------|---------|-----------|
| 房间不存在 | `ROOM_NOT_FOUND` | 提示用户并返回首页 |
| 用户不是参与者 | `NOT_PARTICIPANT` | 重新加入房间 |
| 房间未就绪 | `ROOM_NOT_READY` | 等待对方加入 |
| speakerId 不匹配 | `INVALID_PAYLOAD` | 检查本地状态 |

### 失败降级策略

1. **ASR 服务不可用**: 显示"识别服务暂时不可用"，但不阻断聊天流程
2. **网络抖动**: 客户端本地缓存识别结果，重连后继续
3. **文本同步失败**: 本地显示正常，对方可能看不到（可容忍）

---

## 性能优化

### 1. 节流机制

- Partial 消息节流到 200ms，减少 80% 的消息量
- Final 消息立即发送，确保实时性

### 2. 去重机制

- 使用 `seq` 序列号防止重复处理
- 避免网络重传导致的重复消息

### 3. 会话隔离

- 每个发言者独立会话，互不干扰
- Final 后自动清理，释放内存

---

## 监控指标

### 后端监控

1. **消息处理量**: 每秒处理的 `ASR_TEXT_PUSH` 消息数
2. **去重率**: 被去重丢弃的消息占比
3. **节流效果**: Partial 消息的实际发送间隔
4. **会话数量**: 当前活跃的 ASR 会话数

### 客户端监控

1. **识别延迟**: 从开始录音到收到第一个 Partial 的时间
2. **同步延迟**: 从本地收到识别结果到对方显示的时间
3. **识别准确率**: Final 文本的质量（需要人工标注）

---

## 未来扩展

### 1. 消息持久化

当前 ASR 文本不持久化。未来可以：
- 将 Final 文本保存到数据库
- 提供历史对话查询接口
- 用于 AI 判决模块的输入

### 2. 多语言支持

当前仅支持中文。未来可以：
- 根据用户设置选择语言
- 支持中英文混合识别

### 3. 识别质量优化

- 添加置信度字段
- 低置信度时提示用户重新表述
- 支持用户手动修正识别结果

---

## 相关文档

- [API 规格说明](../api-specification.md)
- [腾讯云 STS Token](08-tencent-sts-token.md)
- [数据模型](../data-models.md)
- [腾讯云实时语音识别文档](https://cloud.tencent.com/document/product/1093/35799)

---

## 总结

ASR 实时语音转文字功能采用**客户端直连架构**：

- ✅ **客户端**: 直接连接腾讯云 ASR，获得低延迟的识别体验
- ✅ **后端**: 负责文本的去重、节流、广播，确保所有参与者状态同步
- ✅ **安全**: 使用 STS 临时凭证，永久密钥不暴露给客户端
- ✅ **可靠**: 去重和节流机制确保消息的准确性和效率
- ✅ **实时**: Partial 文本实时更新，Final 文本立即固化

这种架构在低延迟、高可用性、易扩展性之间取得了最佳平衡。
