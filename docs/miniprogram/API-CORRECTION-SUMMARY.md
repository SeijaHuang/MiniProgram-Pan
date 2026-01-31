# QCloudAIVoice 插件 API 修正总结

> **修正时间**: 2026-01-29  
> **原因**: 初版文档错误使用了腾讯云 WebSocket ASR 的 API，而非小程序插件的官方 API

---

## ✅ 已修正的文档

1. ✅ `docs/miniprogram/chat-room-asr-prd.md` - 产品需求文档
2. ✅ `docs/miniprogram/chat-room-asr-implementation-prompts.md` - 实现 Prompts

---

## 🔴 错误的 API（已废弃）

这些是腾讯云 WebSocket ASR 的 API，**不适用于小程序插件**：

### 错误的初始化方式

```typescript
// ❌ 错误：插件不需要调用 init()
asrManager.init({
    appId: 'YOUR_APPID',
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY',
    engine_model_type: '16k_zh',
    voice_format: 1,
    needvad: 1,
});
```

### 错误的回调方法（小写开头）

```typescript
// ❌ 错误：这些是 WebSocket ASR 的方法
asrManager.onRecognize(result => {}); // 不存在
asrManager.onStop(result => {}); // 不存在
asrManager.onError(error => {}); // 不存在
```

### 错误的启动方式

```typescript
// ❌ 错误：start() 需要传入配置参数
asrManager.start({
    success: () => {},
    fail: error => {},
});
```

---

## ✅ 正确的 API（QCloudAIVoice 插件）

### 1. 获取管理器实例

```typescript
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
const asrManager = QCloudAIVoicePlugin.speechRecognizerManager();
```

**注意**:

- ✅ 不需要调用 `init()` 方法
- ✅ 配置参数在 `start()` 时传入

---

### 2. 官方回调方法（On 开头，首字母大写）

#### OnRecognitionStart

```typescript
asrManager.OnRecognitionStart((res: any) => {
    console.log('[ASR] 开始识别', res);
    // 识别和录音同时启动
});
```

#### OnSentenceBegin

```typescript
asrManager.OnSentenceBegin((res: any) => {
    console.log('[ASR] 一句话开始', res);
});
```

#### OnRecognitionResultChange（实时文本）

```typescript
asrManager.OnRecognitionResultChange((res: any) => {
    console.log('[ASR] 识别结果变化', res);

    // 实时文本在 res.result.voice_text_str
    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextLive: res.result.voice_text_str,
        });
    }
});
```

#### OnSentenceEnd

```typescript
asrManager.OnSentenceEnd((res: any) => {
    console.log('[ASR] 一句话结束', res);

    // 一句话的最终文本
    if (res && res.result && res.result.voice_text_str) {
        this.setData({
            speechTextFinal: res.result.voice_text_str,
        });
    }
});
```

#### OnRecognitionComplete（最终文本）

```typescript
asrManager.OnRecognitionComplete((res: any) => {
    console.log('[ASR] 识别完成', res);

    // 最终文本在 res.result.voice_text_str
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

#### OnError

```typescript
asrManager.OnError((error: any) => {
    console.error('[ASR] 识别错误', error);

    // 错误信息在 error.msg 或 error.message
    this.handleRecognizeError(error);
});
```

#### OnRecorderStop（录音结束）

```typescript
asrManager.OnRecorderStop((res: any) => {
    console.log('[ASR] 录音结束', res);

    // res.tempFilePath 为录音文件的临时路径
    // 如需上传录音文件，可以在这里处理
});
```

#### OnFrameRecorded（帧录制回调）

```typescript
asrManager.OnFrameRecorded((res: any) => {
    console.log('[ASR] 帧录制完成', res);

    // 监听已录制完指定帧大小的回调
    // 可用于实现录音进度条等功能
});
```

---

### 3. 启动识别

```typescript
// ✅ 正确：在 start() 时传入配置参数
asrManager.start({
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY',
    engine_model_type: '16k_zh', // 引擎类型
    voice_format: 1, // 音频格式（1=PCM）
    // 可选参数
    needvad: 1, // 开启VAD
    filter_dirty: 1, // 过滤脏词
    filter_modal: 1, // 过滤语气词
    filter_punc: 0, // 保留标点
});
```

**注意**:

- ✅ `start()` 方法会**同时启动录音和识别**
- ✅ 无需单独调用 `wx.getRecorderManager().start()`
- ✅ 启动成功后会触发 `OnRecognitionStart` 回调

---

### 4. 停止识别

```typescript
// ✅ 正确：直接调用 stop()
asrManager.stop();
```

**注意**:

- ✅ `stop()` 方法会**同时停止录音和识别**
- ✅ 无需单独调用 `wx.getRecorderManager().stop()`
- ✅ 停止后会依次触发：
    1. `OnRecognitionComplete` - 返回最终识别结果
    2. `OnRecorderStop` - 返回录音文件临时路径

---

## 📊 API 对比表

| 功能         | ❌ 错误 API（WebSocket）            | ✅ 正确 API（插件）                            |
| ------------ | ----------------------------------- | ---------------------------------------------- |
| 初始化       | `asrManager.init({...})`            | 不需要 `init()`                                |
| 启动识别     | `asrManager.start({success, fail})` | `asrManager.start({secretId, secretKey, ...})` |
| 停止识别     | `asrManager.stop({success, fail})`  | `asrManager.stop()`                            |
| 实时文本回调 | `onRecognize`                       | `OnRecognitionResultChange`                    |
| 最终文本回调 | `onStop`                            | `OnRecognitionComplete`                        |
| 错误回调     | `onError`                           | `OnError`                                      |
| 录音结束回调 | -                                   | `OnRecorderStop`                               |
| 开始识别回调 | -                                   | `OnRecognitionStart`                           |
| 一句话开始   | -                                   | `OnSentenceBegin`                              |
| 一句话结束   | -                                   | `OnSentenceEnd`                                |
| 帧录制回调   | -                                   | `OnFrameRecorded`                              |

---

## 🔧 迁移指南

如果你之前参考了错误的文档，需要进行以下修改：

### 1. 移除 init() 调用

```typescript
// ❌ 删除这段代码
asrManager.init({
    appId: 'xxx',
    secretId: 'xxx',
    secretKey: 'xxx',
    // ...
});
```

### 2. 修改 start() 调用

```typescript
// ❌ 旧代码
asrManager.start({
    success: () => {},
    fail: error => {},
});

// ✅ 新代码
asrManager.start({
    secretId: ASR_CONFIG.SECRET_ID,
    secretKey: ASR_CONFIG.SECRET_KEY,
    engine_model_type: ASR_CONFIG.ENGINE_MODEL_TYPE,
    voice_format: ASR_CONFIG.VOICE_FORMAT,
});
```

### 3. 修改回调方法名

```typescript
// ❌ 旧代码
asrManager.onRecognize(result => {
    this.setData({ speechTextLive: result.voice_text_str });
});

// ✅ 新代码
asrManager.OnRecognitionResultChange(res => {
    if (res && res.result && res.result.voice_text_str) {
        this.setData({ speechTextLive: res.result.voice_text_str });
    }
});
```

```typescript
// ❌ 旧代码
asrManager.onStop(result => {
    this.setData({ speechTextFinal: result.voice_text_str });
});

// ✅ 新代码
asrManager.OnRecognitionComplete(res => {
    if (res && res.result && res.result.voice_text_str) {
        this.setData({ speechTextFinal: res.result.voice_text_str });
    }
});
```

### 4. 移除录音管理器（可选）

```typescript
// ❌ 删除这些代码（插件已内置）
this.recorderManager = wx.getRecorderManager();
this.recorderManager.start({...});
this.recorderManager.stop();
this.recorderManager.onStart(() => {});
this.recorderManager.onStop(() => {});
```

---

## 📚 参考文档

- [QCloudAIVoice 插件官方文档](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx3e17776051baf153)
- [腾讯云实时语音识别（小程序）](https://cloud.tencent.com/document/product/1093/76151)
- [微信小程序插件使用指南](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html)

---

## ❓ 常见问题

### Q1: 为什么之前的文档用错了 API？

A: 之前混淆了两种不同的 API：

- **腾讯云 WebSocket ASR API**: 用于后端或原生客户端
- **QCloudAIVoice 小程序插件 API**: 专门用于微信小程序

两者虽然都是腾讯云的产品，但 API 设计完全不同。

---

### Q2: 我需要重新申请密钥吗？

A: 不需要。SecretID 和 SecretKey 是通用的，只是使用方式不同：

- 之前：在 `init()` 中传入
- 现在：在 `start()` 中传入

---

### Q3: 插件的回调方法为什么首字母大写？

A: 这是 QCloudAIVoice 插件的官方命名规范，所有回调方法都以 `On` 开头，首字母大写。

---

### Q4: 我还需要使用 wx.getRecorderManager() 吗？

A: 不需要。QCloudAIVoice 插件内部已经集成了录音功能，调用 `start()` 就会同时启动录音和识别。

---

### Q5: 如何知道录音结束了？

A: 监听 `OnRecorderStop` 回调，该回调会在录音结束时触发，并返回录音文件的临时路径。

---

## ✅ 验证清单

使用新 API 后，请验证以下功能：

- [ ] 调用 `start()` 后能够正常录音和识别
- [ ] `OnRecognitionStart` 回调触发，表示开始识别
- [ ] `OnRecognitionResultChange` 回调持续触发，显示实时文本
- [ ] `OnRecognitionComplete` 回调触发，显示最终文本
- [ ] `OnRecorderStop` 回调触发，返回录音文件路径
- [ ] `OnError` 回调在错误时触发
- [ ] 调用 `stop()` 后能够正常停止
- [ ] 控制台无报错信息

---

**修正完成日期**: 2026-01-29  
**修正者**: Claude  
**审核状态**: 待用户验证
