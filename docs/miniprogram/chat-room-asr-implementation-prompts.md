# Chat Room 语音转文字功能 - Claude Code 实现 Prompts

> **说明**: 本文档包含分阶段的详细 prompt，可直接复制给 Claude Code 使用  
> **对应 PRD**: `docs/miniprogram/chat-room-asr-prd.md`  
> **使用方式**: 按顺序逐个阶段执行，每个阶段完成后验收再进入下一阶段

## ⚠️ 重要更新说明（2026-01-29）

**QCloudAIVoice 插件官方 API 已更正**

本文档使用 QCloudAIVoice 小程序插件的**官方 API**：

### 正确的回调方法（On 开头，首字母大写）

- ✅ `OnRecognitionStart` - 开始识别回调
- ✅ `OnSentenceBegin` - 一句话开始回调
- ✅ `OnRecognitionResultChange` - 识别结果变化回调（实时文本）
- ✅ `OnSentenceEnd` - 一句话结束回调
- ✅ `OnRecognitionComplete` - 识别完成回调（最终文本）
- ✅ `OnError` - 识别错误回调
- ✅ `OnRecorderStop` - 录音结束回调
- ✅ `OnFrameRecorded` - 帧录制回调

### 与腾讯云 WebSocket ASR 的区别

- ❌ 不使用 `onRecognize`、`onStop`（这些是 WebSocket API）
- ❌ 不需要调用 `init()` 方法
- ✅ 使用 `start()` 方法时传入配置参数
- ✅ 插件内部集成了录音和识别，无需单独使用 `wx.getRecorderManager()`

---

## 📋 使用说明

### 步骤流程

```
阶段 0: 准备工作（配置）
    ↓
阶段 1: 基础集成（插件引入、配置管理）
    ↓
阶段 2: 核心功能（识别管理器、回调处理）
    ↓
阶段 3: UI 展示（对话框、样式）
    ↓
阶段 4: 状态管理（生命周期、清理）
    ↓
阶段 5: 错误处理（异常兜底）
    ↓
阶段 6: 测试优化（测试、验收）
```

### 注意事项

- ✅ 每个阶段完成后，先测试验收再进入下一阶段
- ✅ 遇到问题及时反馈，不要跳过步骤
- ✅ 保持代码风格与项目一致（遵循 CLAUDE.md 规范）
- ✅ 所有代码必须有明确的类型定义（TypeScript）

---

## 🎯 阶段 0: 准备工作

### Prompt 0.1: 检查当前状态

```
请帮我检查以下内容，告诉我当前项目的状态：

1. 读取 `miniprogram/app.json`，确认 QCloudAIVoice 插件是否已配置
2. 读取 `miniprogram/pages/chat-room/index.ts`，列出当前已有的数据字段
3. 读取 `miniprogram/pages/chat-room/index.wxml`，确认发言舞台区域的结构
4. 检查是否存在 `miniprogram/constants/asr-config.ts` 配置文件

请以清单形式告诉我：
- ✅ 已完成的项
- ❌ 需要创建/修改的项
- ⚠️ 需要注意的项

不要修改任何代码，只做检查和报告。
```

---

### Prompt 0.2: 创建配置文件

```
请创建 ASR 配置文件 `miniprogram/constants/asr-config.ts`，要求：

**配置内容** (用于 QCloudAIVoice 插件的 start 方法):
- 腾讯云 SecretID（从环境变量读取，提供默认值占位符）
- 腾讯云 SecretKey（从环境变量读取，提供默认值占位符）
- 识别引擎类型：16k_zh（中文16k通用）
- 音频格式：1（PCM）
- 其他可选参数：needvad、filter_dirty、filter_modal、filter_punc 等

**代码规范**:
- 使用 TypeScript
- 导出为 const 对象，使用 as const 断言
- 添加清晰的注释说明每个字段的作用
- 遵循项目的 4 空格缩进、单引号、分号规范

**参考 PRD**: docs/miniprogram/chat-room-asr-prd.md 第 8.1 节

创建完成后，展示完整代码并说明如何在代码中使用这些配置。
```

---

## 🎯 阶段 1: 基础集成

### Prompt 1.1: 在 Page Data 中添加识别相关字段

````
请修改 `miniprogram/pages/chat-room/index.ts`，在 Page Data 中添加语音识别相关的数据字段。

**需要添加的字段**:
```typescript
// 语音识别相关
speechTextLive: string;           // 实时识别文本（Partial）
speechTextFinal: string;          // 最终识别文本（Final）
isRecognizing: boolean;           // 是否识别中
recognizeError: string | null;    // 识别错误信息
````

**位置**: 在 `IChatRoomPageData` 接口定义中添加，放在已有字段之后

**初始值**: 在 `Page({})` 的 `data` 对象中添加初始值：

- speechTextLive: ''
- speechTextFinal: ''
- isRecognizing: false
- recognizeError: null

**要求**:

1. 保持与现有代码风格一致
2. 添加清晰的注释
3. 不要修改其他已有字段
4. 确保类型定义准确

完成后，展示修改的代码片段（使用代码引用格式）。

```

---

### Prompt 1.2: 引入 QCloudAIVoice 插件并初始化管理器

```

请修改 `miniprogram/pages/chat-room/index.ts`，完成以下任务：

**任务 1: 引入插件**
在文件顶部（import 语句之后）添加：

```typescript
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
```

**任务 2: 在 Page Custom Option 中添加管理器**
在 `IChatRoomCustomOption` 接口中添加：

```typescript
asrManager: any | null; // 语音识别管理器
```

**任务 3: 在 Page 实例中初始化管理器**
在 `Page<IChatRoomPageData, IChatRoomCustomOption>({})` 中添加：

```typescript
asrManager: null,
```

**任务 4: 在 onLoad 中初始化**
在 `onLoad` 方法的现有初始化代码之后（在 `initRecorderManager()` 之后）添加：

```typescript
// 初始化语音识别管理器（需要在录音管理器之后初始化）
this.initAsrManager();
```

**要求**:

1. 不要修改其他已有代码
2. 保持代码风格一致
3. 确保类型定义正确
4. 添加清晰的注释

完成后，展示修改的代码片段。

```

---

### Prompt 1.3: 实现 initAsrManager 方法

```

请在 `miniprogram/pages/chat-room/index.ts` 中添加 `initAsrManager()` 方法，实现语音识别管理器的初始化和回调注册。

**方法位置**: 放在 `initRecorderManager()` 方法之后

**方法实现要求**:

1. **获取管理器实例**:

```typescript
this.asrManager = QCloudAIVoicePlugin.speechRecognizerManager();
```

2. **读取配置**: 从 `miniprogram/constants/asr-config.ts` 导入配置

3. **注册回调函数**:

```typescript
// 调用回调注册方法
this.initAsrCallbacks();
```

4. **错误处理**: 添加 try-catch，捕获初始化失败的情况

**重要说明**:

- QCloudAIVoice 插件**不需要**调用 `init()` 方法
- 配置参数（如 secretId、secretKey）在调用 `start()` 方法时传入
- 初始化只需要获取管理器实例并注册回调

**代码规范**:

- 添加完整的 JSDoc 注释
- 使用明确的类型定义
- 遵循项目代码风格

完成后，展示完整的 `initAsrManager()` 方法代码。

```

---

## 🎯 阶段 2: 核心功能

### Prompt 2.1: 实现 ASR 回调注册方法

```

请在 `miniprogram/pages/chat-room/index.ts` 中添加 `initAsrCallbacks()` 方法，注册语音识别的核心回调。

**方法位置**: 放在 `initAsrManager()` 方法之后

**QCloudAIVoice 插件提供的官方回调方法**:

1. **开始识别回调 (OnRecognitionStart)**:

```typescript
this.asrManager.OnRecognitionStart((res: any) => {
    console.log('[ASR] 开始识别', res);
    this.setData({
        isRecognizing: true,
    });
});
```

2. **一句话开始回调 (OnSentenceBegin)**:

```typescript
this.asrManager.OnSentenceBegin((res: any) => {
    console.log('[ASR] 一句话开始', res);
});
```

3. **识别结果变化回调 (OnRecognitionResultChange)** - 实时文本更新:

```typescript
this.asrManager.OnRecognitionResultChange((res: any) => {
    console.log('[ASR] 识别结果变化', res);

    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextLive: res.result.voice_text_str,
        });
    }
});
```

4. **一句话结束回调 (OnSentenceEnd)**:

```typescript
this.asrManager.OnSentenceEnd((res: any) => {
    console.log('[ASR] 一句话结束', res);

    // 一句话结束后，将结果固化
    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
        });
    }
});
```

5. **识别完成回调 (OnRecognitionComplete)**:

```typescript
this.asrManager.OnRecognitionComplete((res: any) => {
    console.log('[ASR] 识别完成', res);

    // 识别完成，更新最终文本和状态
    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
            speechTextLive: res.result.voice_text_str,
            isRecognizing: false,
        });
    } else {
        this.setData({
            isRecognizing: false,
        });
    }
});
```

6. **识别错误回调 (OnError)**:

```typescript
this.asrManager.OnError((error: any) => {
    console.error('[ASR] 识别错误', error);
    this.handleRecognizeError(error);
});
```

7. **录音结束回调 (OnRecorderStop)** - 返回录音文件临时路径:

```typescript
this.asrManager.OnRecorderStop((res: any) => {
    console.log('[ASR] 录音结束', res);
    // res.tempFilePath 为录音文件的临时路径
    // 如果需要上传录音文件，可以在这里处理
});
```

**要求**:

1. 添加完整的 JSDoc 注释
2. 添加空值检查
3. 使用明确的类型定义
4. 每个回调添加 console.log 用于调试
5. 注意方法名首字母大写（On开头）

完成后，展示完整的 `initAsrCallbacks()` 方法代码。

```

---

### Prompt 2.2: 实现错误处理方法

```

请在 `miniprogram/pages/chat-room/index.ts` 中添加 `handleRecognizeError()` 方法，用于处理语音识别错误。

**方法签名**:

```typescript
handleRecognizeError(errorMessage: string): void
```

**方法位置**: 放在 `initAsrCallbacks()` 方法之后

**方法实现要求**:

1. **记录错误日志**:

```typescript
console.error('[ASR] 识别错误', errorMessage);
```

2. **更新状态**:

```typescript
this.setData({
    recognizeError: errorMessage,
    isRecognizing: false,
    speechTextLive: '',
});
```

3. **显示 Toast 提示**:

```typescript
void wx.showToast({
    title: '语音识别失败',
    icon: 'error',
    duration: 2000,
});
```

**要求**:

1. 添加完整的 JSDoc 注释，说明参数和功能
2. 使用明确的类型定义
3. 保持代码风格一致

完成后，展示完整的方法代码。

```

---

### Prompt 2.3: 修改 startRecording 方法，使用 ASR 插件替代录音管理器

```

请修改 `miniprogram/pages/chat-room/index.ts` 中的 `startRecording()` 方法，使用 QCloudAIVoice 插件的 start 方法替代原有的录音管理器。

**重要说明**: QCloudAIVoice 插件的 `start()` 方法会同时启动录音和识别，无需分别调用录音管理器。

**修改要求**:

1. **在启动之前，清空识别状态**:

```typescript
// 清空识别状态
this.setData({
    speechTextLive: '',
    speechTextFinal: '',
    recognizeError: null,
    isRecognizing: false,
});
```

2. **替换录音管理器的启动逻辑，改用 ASR 插件的 start 方法**:

```typescript
wx.authorize({
    scope: 'scope.record',
    success: () => {
        // 使用 ASR 插件的 start 方法（同时启动录音和识别）
        if (this.asrManager) {
            this.asrManager.start({
                secretId: ASR_CONFIG.SECRET_ID,
                secretKey: ASR_CONFIG.SECRET_KEY,
                engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
                voice_format: ASR_CONFIG.VOICE_FORMAT,
            });

            // 注意：不要在这里设置 isRecording: true
            // 会在 OnRecognitionStart 回调中设置
            this.setData({ isRecording: true });
        }
    },
    fail: () => {
        void wx.showModal({
            title: '需要录音权限',
            content: '请在设置中开启录音权限',
            confirmText: '去设置',
            success: res => {
                if (res.confirm) {
                    void wx.openSetting();
                }
            },
        });
    },
});
```

3. **注释掉或删除原有的 recorderManager.start() 调用**

**要求**:

1. 使用 ASR 插件的 start 方法替代录音管理器
2. 插件会自动处理录音和识别的启动
3. 添加清晰的注释说明修改部分
4. 保持代码风格一致

**注意**:

- ASR 插件的 `start()` 方法参数中需要传入 secretId、secretKey 等配置
- 识别启动成功会触发 `OnRecognitionStart` 回调
- 不需要再使用 `wx.getRecorderManager()`

完成后，展示修改后的 `startRecording()` 方法完整代码。

```

---

### Prompt 2.4: 修改 stopRecording 方法，使用 ASR 插件停止

```

请修改 `miniprogram/pages/chat-room/index.ts` 中的 `stopRecording()` 方法，使用 QCloudAIVoice 插件的 stop 方法。

**重要说明**: QCloudAIVoice 插件的 `stop()` 方法会同时停止录音和识别。

**修改要求**:

1. **替换录音管理器的停止逻辑，改用 ASR 插件的 stop 方法**:

```typescript
stopRecording(): void {
    if (this.asrManager && this.data.isRecording) {
        // 使用 ASR 插件的 stop 方法（同时停止录音和识别）
        this.asrManager.stop();

        console.log('[ASR] 已调用 stop 方法');

        // 注意：不要在这里立即设置 isRecording: false
        // 会在 OnRecognitionComplete 回调中设置
        this.setData({ isRecording: false });
    }
}
```

2. **删除或注释掉原有的 recorderManager.stop() 调用**

3. **删除或注释掉原有的 Toast 提示**（"语音功能开发中"）

**要求**:

1. 使用 ASR 插件的 stop 方法替代录音管理器
2. 插件会自动处理录音和识别的停止
3. 添加清晰的注释
4. 保持代码风格一致

**注意**:

- 停止后会依次触发 `OnRecognitionComplete` 和 `OnRecorderStop` 回调
- 最终文本会在这些回调中获取

完成后，展示修改后的 `stopRecording()` 方法完整代码。

```

---

## 🎯 阶段 3: UI 展示

### Prompt 3.1: 添加对话框样式

```

请在 `miniprogram/pages/chat-room/index.wxss` 中添加语音识别对话框的样式。

**需要添加的样式类**:

1. **对话框容器** (`.chat-room__speech-bubble`):

- 最大宽度：620rpx
- 最小高度：120rpx
- 内边距：32rpx
- 圆角：28rpx
- 背景：rgba(0, 0, 0, 0.45)
- 边框：6rpx solid rgba(0, 0, 0, 0.8)
- 阴影：0 16rpx 32rpx rgba(0, 0, 0, 0.35)
- 居中显示，flex 布局

2. **文本内容** (`.chat-room__speech-text`):

- 颜色：rgb(255, 255, 255)
- 字号：30rpx
- 行高：1.6
- 文本居中
- 支持换行
- 最大高度：300rpx，超出滚动

3. **占位文案** (`.chat-room__speech-text--placeholder`):

- 颜色：rgb(220, 220, 220)
- 透明度：0.9

4. **错误文案** (`.chat-room__speech-text--error`):

- 颜色：rgb(255, 200, 200)
- 透明度：0.9

5. **最终文本** (`.chat-room__speech-text--final`):

- 颜色：rgb(255, 255, 255)
- 透明度：1

**要求**:

1. 遵循项目的 BEM 命名规范
2. 使用 rpx 单位（响应式）
3. 保持与现有样式风格一致
4. 添加注释说明每个样式块的作用

完成后，展示完整的样式代码。

```

---

### Prompt 3.2: 修改 WXML，添加对话框展示

```

请修改 `miniprogram/pages/chat-room/index.wxml`，在发言舞台区域添加语音识别对话框的展示。

**修改位置**: 找到 `.chat-room__stage` 区域，在麦克风按钮之前添加

**对话框结构**:

```xml
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
```

**要求**:

1. 不要修改其他已有的 DOM 结构
2. 确保对话框不遮挡倒计时
3. 使用 wx:if/wx:elif/wx:else 控制显示逻辑
4. 保持缩进和代码风格一致

完成后，展示修改后的相关 WXML 代码片段。

```

---

## 🎯 阶段 4: 状态管理

### Prompt 4.1: 修改 switchPhase 方法，添加识别状态清理

```

请修改 `miniprogram/pages/chat-room/index.ts` 中的 `switchPhase()` 方法，在阶段切换时清理语音识别状态。

**修改位置**: 在强制停止录音的代码之后

**需要添加的清理逻辑**:

```typescript
// 强制停止录音和识别（使用 ASR 插件）
if (this.asrManager && this.data.isRecording) {
    this.asrManager.stop();
}

// 清空识别状态（新增）
this.setData({
    speechTextLive: '',
    speechTextFinal: '',
    recognizeError: null,
    isRecognizing: false,
    isRecording: false,
});
```

**要求**:

1. 不修改其他已有逻辑
2. 添加清晰的注释
3. 确保识别状态在阶段切换时被完全清理
4. 注意：使用 ASR 插件的 stop 方法，不需要单独停止录音管理器

完成后，展示修改后的 `switchPhase()` 方法中的相关代码片段。

```

---

### Prompt 4.2: 修改 cleanup 方法，添加识别管理器清理

```

请修改 `miniprogram/pages/chat-room/index.ts` 中的 `cleanup()` 方法，在页面隐藏/卸载时清理语音识别管理器。

**修改位置**: 在停止录音的代码之后

**需要添加的清理逻辑**:

```typescript
// 停止语音识别（使用 ASR 插件）
if (this.asrManager && this.data.isRecording) {
    this.asrManager.stop();
}

// 清空识别状态（新增）
this.setData({
    speechTextLive: '',
    speechTextFinal: '',
    recognizeError: null,
    isRecognizing: false,
    isRecording: false,
});
```

**要求**:

1. 确保资源被完全释放
2. 添加清晰的注释
3. 保持代码风格一致
4. 注意：QCloudAIVoice 插件调用 stop() 即可，无需单独销毁

完成后，展示修改后的 `cleanup()` 方法完整代码。

```

---

## 🎯 阶段 5: 错误处理优化

### Prompt 5.1: 添加录音时长检查（可选）

```

**说明**: 由于 QCloudAIVoice 插件内部已经处理了录音时长，此步骤为可选优化项。如果需要在前端额外控制，可以按以下方式实现。

请修改 `miniprogram/pages/chat-room/index.ts`，添加录音时长监控（可选）。

**修改要求**:

1. **在 Page Custom Option 中添加录音开始时间字段**:

```typescript
recordStartTime: number | null; // 录音开始时间戳
```

2. **在 startRecording 中记录开始时间**:

```typescript
startRecording(): void {
    // 记录开始时间
    this.recordStartTime = Date.now();

    // 清空识别状态
    this.setData({
        speechTextLive: '',
        speechTextFinal: '',
        recognizeError: null,
        isRecognizing: false,
    });

    // ... 其余启动逻辑
}
```

3. **在 stopRecording 中添加时长检查（可选）**:

```typescript
stopRecording(): void {
    if (this.asrManager && this.data.isRecording) {
        // 计算录音时长
        const duration: number = this.recordStartTime
            ? Date.now() - this.recordStartTime
            : 0;

        console.log('[ASR] 录音时长:', duration, 'ms');

        // 录音时长小于1秒，提示用户
        if (duration < 1000) {
            console.log('[ASR] 录音时长过短');
            void wx.showToast({
                title: '录音时长过短',
                icon: 'none',
                duration: 1500,
            });
        }

        // 无论时长多少，都调用 stop（插件内部会处理）
        this.asrManager.stop();
        this.setData({ isRecording: false });
    }
}
```

**要求**:

1. 添加清晰的注释说明逻辑
2. 保持代码风格一致
3. 不要强制阻止短时长的识别请求（让插件处理）

完成后，展示修改后的相关代码片段。

```

---

### Prompt 5.2: 优化错误处理，添加错误信息解析

```

请优化 `miniprogram/pages/chat-room/index.ts` 中的 `handleRecognizeError()` 方法，根据错误信息提供更友好的提示。

**修改要求**:

1. **修改方法签名**，支持接收错误对象:

```typescript
handleRecognizeError(error: any): void
```

2. **解析错误信息并提供友好提示**:

```typescript
handleRecognizeError(error: any): void {
    console.error('[ASR] 识别错误', error);

    // 解析错误信息
    const errorMessage: string = error?.msg || error?.message || '识别失败';
    const errorDetail: string = error?.retcode || error?.code || '';

    // 提供友好的用户提示
    let userMessage: string = '语音识别失败';

    // 根据常见错误关键词匹配
    if (errorMessage.includes('鉴权') || errorMessage.includes('auth')) {
        userMessage = '识别服务鉴权失败，请检查配置';
    } else if (errorMessage.includes('未开通') || errorMessage.includes('not activated')) {
        userMessage = '识别服务未开通';
    } else if (errorMessage.includes('余额') || errorMessage.includes('balance')) {
        userMessage = '识别次数已用完';
    } else if (errorMessage.includes('欠费') || errorMessage.includes('arrears')) {
        userMessage = '账户欠费，请充值';
    } else if (errorMessage.includes('格式') || errorMessage.includes('format')) {
        userMessage = '音频格式错误';
    } else if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
        userMessage = '识别超时，请重试';
    } else if (errorMessage.includes('网络') || errorMessage.includes('network')) {
        userMessage = '网络连接失败';
    } else {
        userMessage = '语音识别失败，请重试';
    }

    // 更新状态
    this.setData({
        recognizeError: errorMessage,
        isRecognizing: false,
        isRecording: false,
        speechTextLive: '',
    });

    // 显示 Toast 提示
    void wx.showToast({
        title: userMessage,
        icon: 'error',
        duration: 2000,
    });
}
```

3. **更新 OnError 回调**，传入完整的 error 对象

**要求**:

1. 使用关键词匹配而不是错误码（插件返回的错误格式可能不同）
2. 提供清晰友好的用户提示
3. 保持代码风格一致
4. 添加清晰的注释

完成后，展示修改后的完整方法代码。

```

---

## 🎯 阶段 6: 测试与优化

### Prompt 6.1: 添加调试日志和状态监控

```

请在 `miniprogram/pages/chat-room/index.ts` 中添加完善的调试日志，方便测试时追踪状态。

**需要添加日志的位置**:

1. **initAsrManager 方法**:

```typescript
console.log('[ASR] 初始化语音识别管理器');
console.log('[ASR] 配置参数:', {
    engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
    voice_format: ASR_CONFIG.VOICE_FORMAT,
    needvad: ASR_CONFIG.NEED_VAD,
});
```

2. **startRecording 方法**:

```typescript
console.log('[ASR] 准备启动识别');
console.log('[ASR] 当前状态:', {
    isRecording: this.data.isRecording,
    isRecognizing: this.data.isRecognizing,
});
```

3. **stopRecording 方法**:

```typescript
console.log('[ASR] 准备停止识别', {
    duration: duration,
    isRecognizing: this.data.isRecognizing,
});
```

4. **switchPhase 方法**:

```typescript
console.log('[ASR] 阶段切换，清理识别状态', {
    phase: this.data.phase,
    isRecognizing: this.data.isRecognizing,
});
```

**要求**:

1. 使用统一的日志前缀 `[ASR]`
2. 记录关键状态和参数
3. 不要过度打印日志，影响性能

完成后，展示添加日志的代码示例。

```

---

### Prompt 6.2: 创建测试检查清单

```

请帮我创建一个测试检查清单文档 `docs/miniprogram/chat-room-asr-test-checklist.md`，包含以下内容：

**文档结构**:

1. **功能测试清单**

- [ ] 按住麦克风说话，实时文本正确显示
- [ ] 松开麦克风，最终文本正确显示
- [ ] 录音时长 < 1秒，不启动识别
- [ ] 录音时长 > 60秒，倒计时自动停止
- [ ] 无人声时，显示空结果或错误提示
- [ ] 识别失败时，显示友好错误提示
- [ ] 阶段切换时，识别状态被清空
- [ ] 页面隐藏时，识别被正确停止

2. **UI 测试清单**

- [ ] 对话框样式正确显示
- [ ] 对话框不遮挡倒计时
- [ ] 实时文本滚动显示正常
- [ ] 占位文案样式正确
- [ ] 错误提示样式正确
- [ ] 最终文本样式正确

3. **性能测试清单**

- [ ] 首字延迟 < 500ms
- [ ] 文本更新流畅无卡顿
- [ ] 内存占用正常（< 50MB）
- [ ] 长时间录音无崩溃

4. **兼容性测试清单**

- [ ] iOS 系统测试通过
- [ ] Android 系统测试通过
- [ ] 不同机型测试通过

5. **错误处理测试清单**

- [ ] 网络断开时的错误提示
- [ ] 识别超时的错误提示
- [ ] 配置错误的错误提示
- [ ] 录音失败时的处理

**要求**:

- 使用 Markdown 格式
- 每项测试添加测试步骤说明
- 添加预期结果
- 添加实际结果记录列

创建完成后，展示文档结构概览。

```

---

### Prompt 6.3: 添加配置说明文档

```

请在 PRD 文档 `docs/miniprogram/chat-room-asr-prd.md` 的开头添加一个醒目的"配置前必读"章节，包含以下内容：

**章节内容**:

````markdown
## ⚠️ 配置前必读

在开始使用语音识别功能之前，你需要完成以下配置：

### 1. 腾讯云账号配置

1. **开通服务**:
    - 访问 [腾讯云语音识别控制台](https://console.cloud.tencent.com/asr)
    - 点击"立即开通"按钮
    - 阅读并同意服务协议

2. **获取密钥**:
    - 访问 [API 密钥管理页面](https://console.cloud.tencent.com/cam/capi)
    - 创建新密钥或使用现有密钥
    - 记录以下三个参数：
        - AppID（如：1234567890）
        - SecretID（如：AKIDxxxxxxxxxxxxx）
        - SecretKey（如：xxxxxxxxxxxxxxxx）

3. **配置域名白名单**:
    - 在小程序管理后台 → 开发 → 开发管理 → 服务器域名
    - 在 "socket 合法域名" 中添加：`wss://asr.cloud.tencent.com`
    - 保存并等待生效（约5分钟）

### 2. 小程序代码配置

1. **修改配置文件**:
   打开 `miniprogram/constants/asr-config.ts`，将以下三个值替换为你的实际密钥：
    ```typescript
    APP_ID: 'YOUR_APPID',        // 替换为你的 AppID
    SECRET_ID: 'YOUR_SECRET_ID',  // 替换为你的 SecretID
    SECRET_KEY: 'YOUR_SECRET_KEY', // 替换为你的 SecretKey
    ```
````

2. **重新编译**:
    - 保存文件
    - 在微信开发者工具中点击"编译"
    - 检查控制台是否有配置错误

### 3. 测试验证

1. **打开 Chat Room 页面**
2. **按住麦克风说话**
3. **检查控制台日志**:
    - 应该看到 `[ASR] 初始化语音识别管理器` 日志
    - 应该看到 `[ASR] 识别启动成功` 日志
    - 应该看到 `[ASR] 实时识别结果` 日志

4. **如果失败**:
    - 检查控制台错误信息
    - 参考"错误处理"章节排查问题
    - 确认域名白名单已生效

### 4. 常见问题

**Q: 提示"识别服务鉴权失败"**  
A: 检查 AppID、SecretID、SecretKey 是否正确，是否有多余空格

**Q: 提示"域名不合法"**  
A: 检查小程序后台是否已添加 `wss://asr.cloud.tencent.com` 到 socket 合法域名

**Q: 识别没有反应**  
A: 检查控制台是否有错误日志，确认配置是否正确

**Q: 识别准确率低**  
A: 确保在安静环境测试，说话清晰，距离话筒适中

```

**要求**:
- 放在 PRD 文档的第 1 节"功能概述"之前
- 使用醒目的 emoji 和样式
- 提供详细的操作步骤
- 包含常见问题的解决方案

完成后，告诉我文档已更新。
```

---

### Prompt 6.4: 生成最终验收报告模板

````
请创建一个验收报告模板文档 `docs/miniprogram/chat-room-asr-acceptance-report.md`，用于记录最终验收结果。

**文档结构**:

```markdown
# Chat Room 语音转文字功能验收报告

## 基本信息

- **功能名称**: Chat Room 语音转文字
- **对应 PRD**: docs/miniprogram/chat-room-asr-prd.md
- **开发人员**: [开发者姓名]
- **测试人员**: [测试者姓名]
- **验收日期**: [YYYY-MM-DD]
- **验收结果**: [ ] 通过  [ ] 不通过

---

## 环境信息

- **测试环境**: 开发环境 / 体验版 / 正式版
- **微信版本**: [如：8.0.33]
- **基础库版本**: [如：2.33.0]
- **测试设备**:
  - iOS: [设备型号 + 系统版本]
  - Android: [设备型号 + 系统版本]

---

## P0 功能验收（必须全部通过）

| 序号 | 测试项 | 预期结果 | 实际结果 | 通过 |
|------|--------|---------|---------|------|
| 1 | 按住麦克风说话 | 实时文本正确显示 | | [ ] |
| 2 | 松开麦克风 | 最终文本正确显示 | | [ ] |
| 3 | 识别失败 | 显示错误提示 | | [ ] |
| 4 | 倒计时结束 | 自动停止识别 | | [ ] |
| 5 | 阶段切换 | 识别状态被清空 | | [ ] |
| 6 | 不影响录音 | 原有录音功能正常 | | [ ] |
| 7 | 不影响倒计时 | 倒计时正常运行 | | [ ] |

---

## P1 体验验收（建议通过）

| 序号 | 测试项 | 目标值 | 实际值 | 通过 |
|------|--------|--------|--------|------|
| 1 | 首字延迟 | < 500ms | | [ ] |
| 2 | 识别准确率 | > 90% | | [ ] |
| 3 | 文本刷新 | 流畅无卡顿 | | [ ] |
| 4 | 对话框位置 | 不遮挡倒计时 | | [ ] |
| 5 | 错误提示 | 友好明确 | | [ ] |

---

## Bug 列表

| Bug ID | 描述 | 严重程度 | 状态 | 备注 |
|--------|------|---------|------|------|
| | | P0/P1/P2 | 待修复/已修复 | |

---

## 性能测试

- **内存占用**: [峰值 MB]
- **CPU 占用**: [峰值 %]
- **电量消耗**: [正常/偏高/异常]
- **长时间测试**: [是否有内存泄漏/崩溃]

---

## 兼容性测试

### iOS 测试结果

| 设备型号 | 系统版本 | 测试结果 | 备注 |
|---------|---------|---------|------|
| | | 通过/失败 | |

### Android 测试结果

| 设备型号 | 系统版本 | 测试结果 | 备注 |
|---------|---------|---------|------|
| | | 通过/失败 | |

---

## 成本评估

- **测试期间调用次数**: [次]
- **测试期间时长**: [小时]
- **预估月度成本**: [元]

---

## 验收结论

### 通过条件
- [ ] 所有 P0 功能测试通过
- [ ] 80% 以上 P1 体验测试通过
- [ ] 无 P0 级别 Bug
- [ ] 兼容性测试通过

### 最终评价
[总结功能完成情况、存在的问题、优化建议等]

---

## 附件
- 测试录屏: [链接]
- 日志文件: [链接]
- 性能分析报告: [链接]
````

**要求**:

- 使用表格形式，方便填写
- 包含所有关键测试项
- 提供明确的通过标准
- 支持附件链接

创建完成后，告诉我文档已创建。

```

---

## 📚 附录：完整实施流程

### 使用建议

1. **按顺序执行**: 严格按照阶段 0 → 1 → 2 → 3 → 4 → 5 → 6 的顺序
2. **逐步验收**: 每个阶段完成后，先测试验收再进入下一阶段
3. **保存进度**: 每完成一个阶段，提交 git commit
4. **遇到问题**: 及时反馈给 Claude，不要跳过或忽略错误

### 预计时间

- **阶段 0**: 30分钟（配置准备）
- **阶段 1**: 1小时（基础集成）
- **阶段 2**: 2小时（核心功能）
- **阶段 3**: 1小时（UI 展示）
- **阶段 4**: 30分钟（状态管理）
- **阶段 5**: 1小时（错误处理）
- **阶段 6**: 2小时（测试优化）
- **总计**: 约 8 小时（1个工作日）

### 常见问题

**Q: 如果某个 prompt 执行失败怎么办？**
A: 将错误信息发给 Claude，描述问题现象，Claude 会提供修复方案。

**Q: 可以跳过某些阶段吗？**
A: 不建议跳过，每个阶段都有依赖关系，跳过可能导致后续问题。

**Q: 如何验收每个阶段？**
A: 每个阶段的 prompt 都包含"完成后"的要求，按照要求检查即可。

**Q: 配置参数从哪里获取？**
A: 参考 Prompt 6.3 中的"配置前必读"章节，有详细步骤。

---

## 🎉 完成标志

当所有阶段完成后，你应该能够：

1. ✅ 按住麦克风说话，看到实时识别的文字
2. ✅ 松开麦克风，看到最终稳定的文字
3. ✅ 识别失败时看到友好的错误提示
4. ✅ 倒计时结束时自动停止识别
5. ✅ 阶段切换时识别状态被正确清理
6. ✅ 控制台有清晰的日志输出
7. ✅ 所有 TypeScript 类型检查通过
8. ✅ 代码风格与项目保持一致

**祝开发顺利！🚀**
```
