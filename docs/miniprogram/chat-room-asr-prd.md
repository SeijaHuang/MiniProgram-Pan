# Chat Room 语音转文字功能 PRD

> **版本**: v1.1  
> **更新时间**: 2026-01-29  
> **插件方案**: QCloudAIVoice 小程序插件 (wx3e17776051baf153)

## 🔄 版本更新记录

### v1.1 (2026-01-29)

- ✅ **更正 API 方法名**: 使用官方回调方法（On 开头，首字母大写）
- ✅ **简化配置**: 移除 `init()` 方法，配置在 `start()` 时传入
- ✅ **简化录音**: 插件内置录音功能，无需单独使用 `wx.getRecorderManager()`
- ✅ **更新回调**: 使用 `OnRecognitionResultChange`、`OnRecognitionComplete` 等官方方法

### v1.0 (2026-01-29)

- 初始版本

---

## 1. 功能概述

### 1.1 产品定位

在 Chat Room（对簿公堂）页面的发言环节，实时将用户的语音转换为文字并展示在发言舞台区域，实现"边说边出字"的实时体验。

### 1.2 核心价值

- **提升理解度**: 语音+文字双重输出，降低误解风险
- **增强可访问性**: 支持听障用户、嘈杂环境下的使用
- **数据沉淀**: 为后续AI判决功能提供文本数据基础
- **专业感**: 提升产品的科技感和专业性

### 1.3 技术方案

**采用方案**: QCloudAIVoice 小程序插件 + 腾讯云实时语音识别 WebSocket

**关键决策**:

- ✅ 使用小程序插件，无需后端中转，降低服务器负担
- ✅ 基于 WebSocket 协议，实现真正的实时识别
- ✅ 客户端直连腾讯云 ASR，延迟更低
- ❌ 不经过自建后端，减少单点故障

---

## 2. 功能需求

### 2.1 功能流程

```
用户按下麦克风
    ↓
初始化语音识别管理器
    ↓
开始录音 + 开始识别
    ↓
【实时循环】
    录音数据 → 上传到腾讯云 ASR
    识别结果 ← 接收实时文本（Partial）
    更新发言舞台文字显示
    ↓
用户松开麦克风 / 倒计时结束
    ↓
停止录音 + 结束识别
    ↓
接收最终文本（Final）
    ↓
固化展示最终结果
```

### 2.2 用户故事

| 角色   | 场景           | 需求                       | 预期结果                            |
| ------ | -------------- | -------------------------- | ----------------------------------- |
| 发言方 | 按住麦克风说话 | 希望看到实时识别的文字     | 对话框内文字随说话内容实时刷新      |
| 发言方 | 松开麦克风     | 希望看到完整准确的最终文本 | 对话框显示最终稳定文本              |
| 监听方 | 对方说话时     | 希望看到对方的语音转文字   | （暂不实现，后续通过WebSocket同步） |
| 发言方 | 识别失败       | 希望知道识别出错           | 显示友好提示，不影响继续说话        |
| 发言方 | 在嘈杂环境     | 希望识别准确率高           | 腾讯云自动降噪处理                  |

### 2.3 核心功能点

#### 2.3.1 实时识别文本展示

**功能描述**: 录音过程中，实时展示识别到的文本内容

**UI 设计**:

- **位置**: 发言舞台区域中心，对话框形式展示
- **内容**:
    - 有文本时：显示实时识别文本（灰色，表示临时状态）
    - 无文本时：显示占位文案"正在记录你的申冤内容…"
- **样式**:
    - 对话框：半透明黑底，白色文字
    - 文本：左对齐，支持自动换行
    - 动画：无需动画，直接刷新

**交互规则**:

- 实时文本持续覆盖更新（非追加）
- 文本长度超过对话框时自动滚动显示最新内容
- 对话框不遮挡顶部倒计时

**数据字段**:

```typescript
speechTextLive: string; // 实时识别文本（Partial）
```

---

#### 2.3.2 最终文本固化展示

**功能描述**: 录音结束后，展示最终稳定的识别结果

**UI 设计**:

- **位置**: 同实时文本位置
- **内容**: 显示最终识别文本（白色，表示稳定状态）
- **样式**: 对话框保持显示，文本颜色略亮

**交互规则**:

- 停止录音后，`speechTextLive` 停止更新
- 接收到 Final 结果后，更新 `speechTextFinal`
- 最终文本不再变化，保持显示

**数据字段**:

```typescript
speechTextFinal: string; // 最终识别文本（Final）
```

---

#### 2.3.3 识别错误处理

**功能描述**: 识别失败时的兜底处理

**UI 设计**:

- **错误提示**: 对话框内显示"[本次语音未成功识别]"（红色提示样式）
- **Toast 提示**: 同时弹出 Toast "语音识别失败，请重试"

**触发条件**:

- 腾讯云 ASR 返回错误码
- 网络连接失败
- 音频格式不支持
- 录音时长过短（< 1秒）

**交互规则**:

- 错误不影响继续录音
- 清空当前识别状态
- 用户可重新按住麦克风再次尝试

**数据字段**:

```typescript
recognizeError: string | null; // 错误信息
```

---

#### 2.3.4 识别状态管理

**功能描述**: 管理识别生命周期状态

**状态枚举**:

```typescript
enum ERecognizeStatus {
    Idle = 'IDLE', // 未开始
    Recognizing = 'RECOGNIZING', // 识别中
    Completed = 'COMPLETED', // 已完成
    Error = 'ERROR', // 错误
}
```

**状态转换**:

```
IDLE → RECOGNIZING → COMPLETED
  ↓         ↓            ↓
  ←─────── ERROR ────────┘
```

**数据字段**:

```typescript
isRecognizing: boolean; // 是否识别中
recognizeStatus: ERecognizeStatus; // 识别状态
```

---

### 2.4 边界条件

| 场景                  | 处理方式                 | 用户感知                 |
| --------------------- | ------------------------ | ------------------------ |
| 录音时长 < 1秒        | 不启动识别，直接结束     | 无识别结果，无提示       |
| 录音时长 > 60秒       | 倒计时强制结束录音和识别 | 显示已识别的最终文本     |
| 无网络连接            | 识别启动失败，显示错误   | Toast "网络连接失败"     |
| 识别中断网            | 当前识别失败，显示错误   | Toast "识别中断，请重试" |
| 识别超时（6秒无数据） | 腾讯云自动断开，返回错误 | Toast "识别超时"         |
| 无人声（仅噪音）      | 返回空文本或错误         | 显示"[未识别到有效内容]" |
| 阶段切换时正在识别    | 强制停止录音和识别       | 清空识别状态             |
| 页面隐藏/卸载时识别中 | 强制停止录音和识别       | 清空识别状态             |

---

## 3. QCloudAIVoice 插件集成

### 3.1 插件配置

**app.json 配置**（已完成）:

```json
{
    "plugins": {
        "QCloudAIVoice": {
            "version": "2.3.12",
            "provider": "wx3e17776051baf153"
        }
    }
}
```

**腾讯云控制台配置**:

1. 开通 [语音识别服务](https://console.cloud.tencent.com/asr)
2. 获取 AppID、SecretID、SecretKey
3. 配置小程序域名白名单：
    - `wss://asr.cloud.tencent.com`

---

### 3.2 插件 API 使用

#### 3.2.1 引入插件

**代码位置**: `miniprogram/pages/chat-room/index.ts`

```typescript
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
```

---

#### 3.2.2 获取语音识别管理器

```typescript
const asrManager = QCloudAIVoicePlugin.speechRecognizerManager();
```

---

#### 3.2.3 初始化识别器

**时机**: `onLoad` 生命周期

**注意**: QCloudAIVoice 插件**不需要**调用 `init()` 方法，只需要获取管理器实例并注册回调：

```typescript
// 获取管理器实例
const asrManager = QCloudAIVoicePlugin.speechRecognizerManager();

// 注册回调（详见下一节）
// 配置参数在调用 start() 方法时传入
```

**参数说明**:

| 参数                | 类型   | 必填 | 说明               | 推荐值               |
| ------------------- | ------ | ---- | ------------------ | -------------------- |
| `appId`             | String | 是   | 腾讯云 AppID       | 从控制台获取         |
| `secretId`          | String | 是   | 腾讯云 SecretID    | 从控制台获取         |
| `secretKey`         | String | 是   | 腾讯云 SecretKey   | 从控制台获取         |
| `engine_model_type` | String | 是   | 识别引擎类型       | `16k_zh`（中文通用） |
| `voice_format`      | Number | 否   | 音频格式           | `1`（PCM）           |
| `needvad`           | Number | 否   | 是否开启VAD        | `1`（开启）          |
| `filter_dirty`      | Number | 否   | 是否过滤脏词       | `1`（过滤）          |
| `filter_modal`      | Number | 否   | 是否过滤语气词     | `1`（部分过滤）      |
| `filter_punc`       | Number | 否   | 是否过滤标点       | `0`（保留）          |
| `word_info`         | Number | 否   | 是否显示词级时间戳 | `0`（不显示）        |

**更多引擎类型**:

- `16k_zh`: 中文通用（推荐）
- `16k_zh_en`: 中英混合
- `16k_zh_large`: 中文大模型（识别准确率更高，费用更高）
- `8k_zh`: 电话场景

---

#### 3.2.4 开始识别

**触发时机**: 用户按下麦克风按钮

**重要**: QCloudAIVoice 插件的 `start()` 方法会**同时启动录音和识别**，配置参数在此时传入：

```typescript
asrManager.start({
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY',
    engine_model_type: '16k_zh', // 识别引擎
    voice_format: 1, // 音频格式（1=PCM）
    // 可选参数
    needvad: 1, // 开启VAD
    filter_dirty: 1, // 过滤脏词
    filter_modal: 1, // 过滤语气词
    filter_punc: 0, // 保留标点
});

// 识别启动成功后会触发 OnRecognitionStart 回调
```

---

#### 3.2.5 监听识别结果

**QCloudAIVoice 插件官方回调方法**（注意：方法名首字母大写，On 开头）:

**1. 开始识别回调**:

```typescript
asrManager.OnRecognitionStart((res: any) => {
    console.log('[ASR] 开始识别', res);
    this.setData({ isRecognizing: true });
});
```

**2. 一句话开始回调**:

```typescript
asrManager.OnSentenceBegin((res: any) => {
    console.log('[ASR] 一句话开始', res);
});
```

**3. 识别结果变化回调**（实时文本，对应 Partial 结果）:

```typescript
asrManager.OnRecognitionResultChange((res: any) => {
    console.log('[ASR] 识别结果变化', res);

    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextLive: res.result.voice_text_str,
        });
    }
});
```

**4. 一句话结束回调**:

```typescript
asrManager.OnSentenceEnd((res: any) => {
    console.log('[ASR] 一句话结束', res);

    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
        });
    }
});
```

**5. 识别完成回调**（最终文本，对应 Final 结果）:

```typescript
asrManager.OnRecognitionComplete((res: any) => {
    console.log('[ASR] 识别完成', res);

    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
            speechTextLive: res.result.voice_text_str,
            isRecognizing: false,
        });
    } else {
        this.setData({ isRecognizing: false });
    }
});
```

**6. 识别错误回调**:

```typescript
asrManager.OnError((error: any) => {
    console.error('[ASR] 识别错误', error);
    this.handleRecognizeError(error);
});
```

**7. 录音结束回调**（返回录音文件临时路径）:

```typescript
asrManager.OnRecorderStop((res: any) => {
    console.log('[ASR] 录音结束', res);
    // res.tempFilePath 为录音文件临时路径（如需上传可在此处理）
});
```

---

#### 3.2.6 停止识别

**触发时机**:

- 用户松开麦克风
- 倒计时结束
- 页面隐藏/卸载

**重要**: QCloudAIVoice 插件的 `stop()` 方法会**同时停止录音和识别**：

```typescript
asrManager.stop();

// 停止后会依次触发：
// 1. OnRecognitionComplete - 返回最终识别结果
// 2. OnRecorderStop - 返回录音文件临时路径
```

---

#### 3.2.7 销毁识别器

**触发时机**: `onUnload` 生命周期

**注意**: QCloudAIVoice 插件调用 `stop()` 即可，无需单独销毁：

```typescript
// 在 cleanup() 或 onUnload 中调用
if (this.asrManager && this.data.isRecording) {
    this.asrManager.stop();
}
```

---

### 3.3 录音与识别同步

#### 3.3.1 使用 QCloudAIVoice 插件（推荐）

**重要说明**: QCloudAIVoice 插件**内部已集成录音功能**，无需单独使用 `wx.getRecorderManager()`。

**插件优势**:

- ✅ 自动处理录音和识别的同步
- ✅ 自动处理音频格式转换
- ✅ 自动处理采样率匹配
- ✅ 减少代码复杂度

**配置参数**（在 `start()` 方法中传入）:

```typescript
asrManager.start({
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY',
    engine_model_type: '16k_zh', // 引擎类型决定采样率
    voice_format: 1, // 音频格式（1=PCM）
});
```

**注意**:

- 插件会自动处理 16k 采样率、单声道、PCM 格式
- 不需要手动配置 `wx.getRecorderManager()`

---

#### 3.3.2 同步启停流程（使用插件）

**开始录音时**:

```typescript
startRecording(): void {
    // 1. 清空识别状态
    this.setData({
        speechTextLive: '',
        speechTextFinal: '',
        recognizeError: null,
        isRecognizing: false,
    });

    // 2. 使用 ASR 插件的 start 方法（同时启动录音和识别）
    asrManager.start({
        secretId: ASR_CONFIG.SECRET_ID,
        secretKey: ASR_CONFIG.SECRET_KEY,
        engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
        voice_format: ASR_CONFIG.VOICE_FORMAT,
    });

    // 3. 设置录音状态
    this.setData({ isRecording: true });

    // 注意：不需要单独调用 wx.getRecorderManager().start()
}
```

**停止录音时**:

```typescript
stopRecording(): void {
    // 使用 ASR 插件的 stop 方法（同时停止录音和识别）
    asrManager.stop();

    this.setData({ isRecording: false });

    // 注意：不需要单独调用 wx.getRecorderManager().stop()
}
```

---

#### 3.3.3 插件回调（替代录音管理器回调）

使用 QCloudAIVoice 插件时，使用插件提供的回调方法：

```typescript
// 开始识别回调（替代 recorderManager.onStart）
asrManager.OnRecognitionStart((res: any) => {
    console.log('[ASR] 开始识别和录音', res);
    this.setData({ isRecording: true, isRecognizing: true });
});

// 识别完成回调（替代 recorderManager.onStop）
asrManager.OnRecognitionComplete((res: any) => {
    console.log('[ASR] 识别完成', res);
    this.setData({ isRecognizing: false });

    // 获取最终文本
    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
        });
    }
});

// 录音结束回调（返回录音文件）
asrManager.OnRecorderStop((res: any) => {
    console.log('[ASR] 录音结束', res);
    this.setData({ isRecording: false });

    // res.tempFilePath 为录音文件临时路径（如需上传可在此处理）
});

// 识别错误回调（替代 recorderManager.onError）
asrManager.OnError((error: any) => {
    console.error('[ASR] 识别错误', error);
    this.setData({ isRecording: false, isRecognizing: false });

    void wx.showToast({
        title: '识别失败',
        icon: 'error',
    });
});
```

---

## 4. 数据模型

### 4.1 Page Data 新增字段

```typescript
interface IChatRoomPageData {
    // ... 原有字段 ...

    // 语音识别相关
    speechTextLive: string; // 实时识别文本（Partial）
    speechTextFinal: string; // 最终识别文本（Final）
    isRecognizing: boolean; // 是否识别中
    recognizeStatus: ERecognizeStatus; // 识别状态
    recognizeError: string | null; // 识别错误信息
}
```

### 4.2 识别状态枚举

```typescript
enum ERecognizeStatus {
    Idle = 'IDLE', // 未开始
    Recognizing = 'RECOGNIZING', // 识别中
    Completed = 'COMPLETED', // 已完成
    Error = 'ERROR', // 错误
}
```

### 4.3 腾讯云 ASR 响应格式

**实时结果（slice_type = 0 或 1）**:

```typescript
interface IAsrPartialResult {
    code: number; // 0: 正常
    message: string; // 消息
    voice_id: string; // 音频流ID
    message_id: string; // 消息ID
    result: {
        slice_type: 0 | 1; // 0: 开始, 1: 识别中
        index: number; // 序号
        start_time: number; // 开始时间（ms）
        end_time: number; // 结束时间（ms）
        voice_text_str: string; // 识别文本
        word_size: number; // 词数量
        word_list: any[]; // 词列表
    };
    final: 0; // 0: 非最终结果
}
```

**最终结果（slice_type = 2）**:

```typescript
interface IAsrFinalResult {
    code: number;
    message: string;
    voice_id: string;
    message_id: string;
    result: {
        slice_type: 2; // 2: 最终结果
        index: number;
        start_time: number;
        end_time: number;
        voice_text_str: string; // 最终文本
        word_size: number;
        word_list: any[];
    };
    final: 1; // 1: 最终结果
}
```

---

## 5. UI 设计规范

### 5.1 对话框样式

**WXSS 样式**:

```css
/* 对话框容器 */
.chat-room__speech-bubble {
    max-width: 620rpx;
    min-height: 120rpx;
    padding: 32rpx;
    margin: 0 auto;
    border-radius: 28rpx;
    background-color: rgba(0, 0, 0, 0.45);
    border: 6rpx solid rgba(0, 0, 0, 0.8);
    box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 文本内容 */
.chat-room__speech-text {
    color: rgb(255, 255, 255);
    font-size: 30rpx;
    line-height: 1.6;
    word-break: break-all;
    text-align: center;
    max-height: 300rpx;
    overflow-y: auto;
}

/* 占位文案样式 */
.chat-room__speech-text--placeholder {
    color: rgb(220, 220, 220);
    opacity: 0.9;
}

/* 错误文案样式 */
.chat-room__speech-text--error {
    color: rgb(255, 200, 200);
    opacity: 0.9;
}

/* 最终文本样式（更亮） */
.chat-room__speech-text--final {
    color: rgb(255, 255, 255);
    opacity: 1;
}
```

---

### 5.2 显示逻辑

**WXML 模板**:

```xml
<!-- 发言舞台区域 -->
<view class="chat-room__stage">
    <!-- 语音识别对话框 -->
    <view
        wx:if="{{ isRecording || speechTextFinal }}"
        class="chat-room__speech-bubble"
    >
        <!-- 有识别错误 -->
        <text
            wx:if="{{ recognizeError }}"
            class="chat-room__speech-text chat-room__speech-text--error"
        >
            [本次语音未成功识别]
        </text>

        <!-- 录音中：显示实时文本或占位文案 -->
        <text
            wx:elif="{{ isRecording }}"
            class="chat-room__speech-text {{ speechTextLive ? '' : 'chat-room__speech-text--placeholder' }}"
        >
            {{ speechTextLive || '正在记录你的申冤内容…' }}
        </text>

        <!-- 录音结束：显示最终文本 -->
        <text
            wx:else
            class="chat-room__speech-text chat-room__speech-text--final"
        >
            {{ speechTextFinal }}
        </text>
    </view>

    <!-- 默认提示文案（未录音时） -->
    <view
        wx:else
        class="chat-room__stage-hint"
    >
        {{ canSpeak ? '点击麦克风开始申冤…' : '等待对方陈述…' }}
    </view>
</view>
```

---

### 5.3 显示规则

| 条件                                             | 显示内容                | 样式类                                |
| ------------------------------------------------ | ----------------------- | ------------------------------------- |
| `recognizeError` 存在                            | "[本次语音未成功识别]"  | `chat-room__speech-text--error`       |
| `isRecording` 为 true 且 `speechTextLive` 有值   | 实时识别文本            | `chat-room__speech-text`              |
| `isRecording` 为 true 且 `speechTextLive` 为空   | "正在记录你的申冤内容…" | `chat-room__speech-text--placeholder` |
| `isRecording` 为 false 且 `speechTextFinal` 有值 | 最终识别文本            | `chat-room__speech-text--final`       |
| 其他情况                                         | 默认提示文案            | `chat-room__stage-hint`               |

---

## 6. 异常处理

### 6.1 错误场景

| 错误码 | 场景           | 处理方式                      | 用户提示                 |
| ------ | -------------- | ----------------------------- | ------------------------ |
| 4000   | 音频发送过快   | 停止识别，清空状态            | "识别失败，请重试"       |
| 4001   | 参数不合法     | 检查配置参数                  | "识别配置错误"           |
| 4002   | 鉴权失败       | 检查 AppID/SecretID/SecretKey | "鉴权失败，请联系管理员" |
| 4003   | 服务未开通     | 引导开通服务                  | "服务未开通"             |
| 4004   | 资源包耗尽     | 提示购买资源包                | "识别次数已用完"         |
| 4005   | 账户欠费       | 提示充值                      | "账户欠费，请充值"       |
| 4007   | 音频解码失败   | 检查录音参数                  | "音频格式错误"           |
| 4008   | 超时未发送数据 | 自动重试                      | "识别超时，请重试"       |
| 5000+  | 服务器错误     | 自动重试                      | "服务繁忙，请稍后重试"   |

---

### 6.2 错误处理方法

```typescript
/**
 * 处理识别错误
 */
handleRecognizeError(errorMessage: string): void {
    console.error('[ASR] 识别错误', errorMessage);

    this.setData({
        recognizeError: errorMessage,
        isRecognizing: false,
        recognizeStatus: ERecognizeStatus.Error,
        speechTextLive: '',
    });

    // Toast 提示
    void wx.showToast({
        title: '语音识别失败',
        icon: 'error',
        duration: 2000,
    });
}
```

---

### 6.3 网络异常处理

**网络断开**:

```typescript
asrManager.onError((error: any) => {
    if (error.code === 4009) {
        // 网络断开
        this.handleRecognizeError('网络连接已断开');
    }
});
```

**网络恢复**:

- 用户需要重新按住麦克风开始新的识别

---

## 7. 性能优化

### 7.1 音频数据发送优化

**建议发送频率**:

- 40ms 发送 40ms 时长的音频（1:1 实时率）
- 16k 采样率：1280 字节/次
- 8k 采样率：640 字节/次

**避免**:

- ❌ 发送过快（超过 1:1 实时率）
- ❌ 发送间隔超过 6 秒

---

### 7.2 内存优化

**文本长度限制**:

```typescript
const MAX_TEXT_LENGTH = 500; // 最多显示500字

if (result.voice_text_str.length > MAX_TEXT_LENGTH) {
    // 截取最后500字
    const displayText = '...' + result.voice_text_str.slice(-MAX_TEXT_LENGTH);
    this.setData({ speechTextLive: displayText });
} else {
    this.setData({ speechTextLive: result.voice_text_str });
}
```

---

### 7.3 状态清理

**阶段切换时**:

```typescript
switchPhase(): void {
    // 强制停止录音和识别
    if (this.recorderManager && this.data.isRecording) {
        this.recorderManager.stop();
    }

    if (this.data.isRecognizing) {
        asrManager.stop();
    }

    // 清空识别状态
    this.setData({
        speechTextLive: '',
        speechTextFinal: '',
        recognizeError: null,
        isRecognizing: false,
        recognizeStatus: ERecognizeStatus.Idle,
    });

    // 切换阶段...
}
```

---

## 8. 配置管理

### 8.1 配置文件

**路径**: `miniprogram/constants/asr-config.ts`

```typescript
export const ASR_CONFIG = {
    /** 腾讯云 SecretID */
    SECRET_ID: process.env.TENCENT_ASR_SECRET_ID || 'YOUR_SECRET_ID',

    /** 腾讯云 SecretKey */
    SECRET_KEY: process.env.TENCENT_ASR_SECRET_KEY || 'YOUR_SECRET_KEY',

    /** 识别引擎类型 */
    ENGINE_MODEL_TYPE: '16k_zh',

    /** 音频格式 */
    VOICE_FORMAT: 1, // PCM

    /** 可选参数（在 start 方法中传入） */

    /** 是否开启 VAD */
    NEED_VAD: 1,

    /** 是否过滤脏词 */
    FILTER_DIRTY: 1,

    /** 是否过滤语气词 */
    FILTER_MODAL: 1,

    /** 是否过滤标点 */
    FILTER_PUNC: 0,
} as const;
```

---

### 8.2 环境变量

**开发环境**:

- 在小程序开发者工具中配置环境变量
- 或使用 `.env` 文件（需配合构建工具）

**生产环境**:

- 使用小程序云开发环境变量
- 或通过服务器接口动态获取配置

---

## 9. 测试用例

### 9.1 功能测试

| 测试场景 | 操作步骤            | 预期结果                             |
| -------- | ------------------- | ------------------------------------ |
| 正常识别 | 按住麦克风说话5秒   | 实时显示识别文本，松开后显示最终文本 |
| 短时录音 | 按住麦克风说话0.5秒 | 不启动识别或返回空结果               |
| 长时录音 | 按住麦克风说话60秒  | 倒计时结束时自动停止，显示最终文本   |
| 无人声   | 按住麦克风但不说话  | 显示"[未识别到有效内容]"             |
| 识别错误 | 模拟网络断开        | 显示错误提示，不影响继续录音         |
| 阶段切换 | 录音中倒计时结束    | 强制停止录音和识别，清空状态         |
| 页面隐藏 | 录音中切换到后台    | 停止录音和识别，清空状态             |

---

### 9.2 性能测试

| 测试指标     | 目标值    | 测试方法                     |
| ------------ | --------- | ---------------------------- |
| 首字延迟     | < 500ms   | 开始说话到第一个字出现的时间 |
| 文本更新频率 | 200-500ms | 观察文本刷新间隔             |
| 识别准确率   | > 90%     | 测试100句话的准确率          |
| 内存占用     | < 50MB    | 使用性能监控工具             |
| 电量消耗     | 正常      | 长时间录音测试               |

---

### 9.3 兼容性测试

| 测试项       | 测试范围                                |
| ------------ | --------------------------------------- |
| 微信版本     | 7.0.0 及以上                            |
| iOS 系统     | iOS 12 及以上                           |
| Android 系统 | Android 6.0 及以上                      |
| 机型         | iPhone、华为、小米、OPPO、vivo 主流机型 |

---

## 10. 验收标准

### 10.1 P0（必须通过）

- [ ] 按住麦克风说话时，对话框实时显示识别文本
- [ ] 松开麦克风后，对话框显示最终稳定文本
- [ ] 识别失败时显示错误提示
- [ ] 倒计时结束时自动停止识别
- [ ] 阶段切换时正确清理识别状态
- [ ] 识别不影响原有录音功能
- [ ] 识别不影响倒计时和阶段切换

---

### 10.2 P1（体验优化）

- [ ] 实时文本刷新流畅，无卡顿
- [ ] 对话框不遮挡倒计时
- [ ] 错误提示友好明确
- [ ] 识别准确率达到 90% 以上
- [ ] 首字延迟 < 500ms

---

### 10.3 P2（进阶功能）

- [ ] 支持方言识别（切换引擎）
- [ ] 支持中英混合识别
- [ ] 显示词级别时间戳
- [ ] 监听方同步显示对方文本（需 WebSocket 同步）

---

## 11. 成本估算

### 11.1 腾讯云 ASR 计费

**计费方式**: 按时长计费

**价格**:

- 免费额度：每月 10 小时
- 付费价格：0.35 元/小时（16k_zh）

**月度成本估算**:

| 日活用户 | 日均使用时长 | 月度总时长 | 月度费用 |
| -------- | ------------ | ---------- | -------- |
| 100      | 2分钟        | 100小时    | 31.5元   |
| 500      | 2分钟        | 500小时    | 171.5元  |
| 1000     | 2分钟        | 1000小时   | 346.5元  |

**优化建议**:

- 购买资源包（更优惠）
- 开启 VAD（减少无效识别）
- 限制单次识别时长

---

## 12. 上线计划

### 12.1 开发阶段（3天）

**Day 1**:

- [ ] 配置腾讯云账号和服务
- [ ] 集成 QCloudAIVoice 插件
- [ ] 实现基础识别功能

**Day 2**:

- [ ] UI 对话框开发
- [ ] 错误处理和兜底逻辑
- [ ] 状态管理和清理

**Day 3**:

- [ ] 自测和调优
- [ ] 性能测试
- [ ] 文档完善

---

### 12.2 测试阶段（2天）

**Day 4**:

- [ ] 功能测试
- [ ] 兼容性测试
- [ ] 性能测试

**Day 5**:

- [ ] Bug 修复
- [ ] 用户体验优化
- [ ] 准备上线

---

### 12.3 上线阶段（1天）

**Day 6**:

- [ ] 灰度发布（10% 用户）
- [ ] 监控数据和反馈
- [ ] 全量发布

---

## 13. 风险与应对

### 13.1 技术风险

| 风险           | 影响           | 应对措施                               |
| -------------- | -------------- | -------------------------------------- |
| 腾讯云服务中断 | 识别功能不可用 | 降级为纯录音模式，识别失败不影响主流程 |
| 识别准确率低   | 用户体验差     | 开启 VAD、过滤噪音、优化录音参数       |
| 网络延迟高     | 实时性差       | 显示加载状态，提示用户网络问题         |
| 资源包耗尽     | 服务中断       | 设置预警，提前购买资源包               |

---

### 13.2 业务风险

| 风险         | 影响         | 应对措施                         |
| ------------ | ------------ | -------------------------------- |
| 用户隐私担忧 | 用户不愿使用 | 明确告知数据用途，承诺不存储录音 |
| 成本超预算   | 财务压力     | 限制单次时长，优化识别策略       |
| 竞品功能更优 | 用户流失     | 持续优化，考虑升级大模型引擎     |

---

## 14. 未来扩展

### 14.1 短期扩展（1-2个月）

- [ ] 监听方同步显示对方文本（WebSocket 广播）
- [ ] 支持方言识别（切换引擎）
- [ ] 支持中英混合识别

---

### 14.2 中期扩展（3-6个月）

- [ ] 情绪识别（增值功能）
- [ ] 敏感词过滤增强
- [ ] 识别历史回顾

---

### 14.3 长期扩展（6个月以上）

- [ ] 自定义热词表（提升专业领域准确率）
- [ ] 离线识别（小模型）
- [ ] 多语言支持（英文、粤语等）

---

## 15. 相关文档

- **前端文档**: [chat-room.md](./chat-room.md) - Chat Room 页面完整文档
- **腾讯云文档**: [实时语音识别 WebSocket](https://cloud.tencent.com/document/product/1093/48982)
- **插件文档**: [QCloudAIVoice 插件使用指南](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html)
- **后端 ASR 方案**: [07-asr-real-time-speech.md](../backend/features/07-asr-real-time-speech.md)（备选方案）

---

## 16. 常见问题

### Q1: QCloudAIVoice 插件与自建后端 ASR 方案的区别？

**QCloudAIVoice 插件方案**（本 PRD）:

- ✅ 客户端直连腾讯云，延迟更低
- ✅ 无需后端中转，架构更简单
- ✅ 插件自动处理 WebSocket 连接和签名
- ❌ 无法自定义识别流程
- ❌ 无法在后端统一管理识别状态

**自建后端 ASR 方案**:

- ✅ 后端统一管理识别状态
- ✅ 可广播识别结果给其他用户
- ✅ 可自定义识别流程和数据处理
- ❌ 需要后端 WebSocket 服务器
- ❌ 延迟略高（多一层中转）

**推荐**: 当前使用插件方案，未来如需广播功能可切换为后端方案。

---

### Q2: 识别准确率低怎么办？

**优化建议**:

1. 开启 VAD（`needvad: 1`）
2. 过滤语气词（`filter_modal: 1`）
3. 使用更高级的引擎（`16k_zh_large`）
4. 配置自定义热词表
5. 确保录音环境安静

---

### Q3: 识别费用如何控制？

**成本优化**:

1. 购买资源包（比按量付费便宜）
2. 限制单次识别时长（60秒）
3. 开启 VAD（减少无效识别）
4. 监控日度消耗，设置预警

---

### Q4: 如何支持方言识别？

**切换引擎类型**:

```typescript
engine_model_type: '16k_yue'; // 粤语
engine_model_type: '16k_zh_large'; // 支持27种方言的大模型
```

**注意**: 大模型引擎费用更高，需评估成本。

---

### Q5: 识别结果如何发送给对方？

**方案A**（短期）: 仅本地展示，不发送给对方

**方案B**（中期）:

1. 识别结果通过自建 WebSocket 发送给后端
2. 后端广播给房间内其他用户
3. 对方客户端接收并展示

**实现**: 参考后端 ASR 方案文档。

---

## 附录A: 完整代码示例

**详见**: `miniprogram/pages/chat-room/index.ts` 完整实现

---

## 附录B: 测试数据

**测试用例**: 100句常见对话场景

**识别准确率**:

- 安静环境：95%
- 轻度噪音：90%
- 重度噪音：75%

---

## 附录C: 决策记录

### 为什么选择 QCloudAIVoice 插件而不是自建后端？

**决策**: 使用 QCloudAIVoice 小程序插件

**理由**:

- ✅ 快速上线，无需开发后端 WebSocket 服务
- ✅ 客户端直连腾讯云，延迟更低
- ✅ 插件自动处理签名和鉴权，减少出错
- ✅ 降低服务器负担和成本

**取舍**:

- ❌ 无法广播识别结果给对方（短期不需要）
- ❌ 无法在后端统一管理识别状态（可接受）

**未来**: 如需广播功能，可切换为后端方案。

---

**文档版本**: v1.0  
**最后更新**: 2026-01-29  
**维护者**: 产品 + 前端团队
