# Chat Room（对簿公堂）页面文档

基于《Chat Room（对簿公堂）功能 PRD v1.0》梳理的实现文档，对应页面代码位于：

- `miniprogram/packageB/pages/chat-room/index.json`
- `miniprogram/packageB/pages/chat-room/index.wxml`
- `miniprogram/packageB/pages/chat-room/index.wxss`
- `miniprogram/packageB/pages/chat-room/index.ts`

本文档用于在产品、设计、前端之间对齐「Chat Room」的目标、布局和交互细节。

---

## 1. 页面基本信息

| 项目     | 说明                              |
| -------- | --------------------------------- |
| 页面名称 | Chat Room（对簿公堂）             |
| 页面路径 | `/packageB/pages/chat-room/index` |
| 页面类型 | 核心对簿与情绪释放页面            |
| 进入方式 | Drum Room 结束后自动跳转          |
| 退出方式 | 双方完成发言后跳转至 AI 分析页    |
| 设计风格 | 强舞台感、娱乐化、视觉即状态      |
| 优先级   | P0（主流程核心页面）              |

---

## 2. 页面目标（Why）

### 2.1 核心目标

1. **保证发言顺序公平、清晰** - 通过倒计时和状态机确保双方轮流发言
2. **通过倒计时制造紧张与仪式感** - 倒计时作为唯一顶部信息，不同阶段有不同视觉反馈
3. **用表情系统提供非语言情绪出口** - 监听方可通过表情互动，不影响发言流程
4. **降低理解成本，减少状态说明文字** - 视觉即状态，通过动画和颜色传达信息

### 2.2 用户心理状态

- 情绪：紧张、期待、想要表达
- 行为：会关注倒计时，在发言时专注表达，在监听时可能使用表情互动
- 风险：
    - 倒计时压力导致表达不完整
    - 不清楚当前状态（谁在发言）
    - 录音失败导致流程中断

---

## 3. 页面整体结构

```
┌──────────────────────────────┐
│        ⏳ 倒计时（居中）       │  ← 顶部倒计时区域
├──────────────────────────────┤
│                              │
│        发言舞台区域           │  ← 状态提示 / 语音反馈
│   （默认文案 / 录音中状态）   │
│                              │
│           🎙 麦克风            │  ← 麦克风按钮
│                              │
├──────────────────────────────┤
│        表情互动展示区         │  ← 表情弹幕 / 飞行物
├──────────────────────────────┤
│        表情按钮面板           │  ← 表情按钮（仅监听方可见）
└──────────────────────────────┘
```

### 3.1 视觉层级（z-index）

- **Layer 1 - 背景层**
    - 整个页面的渐变背景
- **Layer 2 - 内容层**
    - 倒计时、发言舞台、麦克风按钮
- **Layer 3 - 表情展示层**
    - 表情弹幕 / 飞行物（不遮挡倒计时）
- **Layer 4 - 交互层**
    - 表情按钮面板

---

## 4. 顶部倒计时设计（核心元素）

### 4.1 设计原则

- **页面顶部不再区分玩家身份**
- **不显示「你正在发言 / 对方正在听」文案**
- **倒计时作为唯一顶部信息**

### 4.2 倒计时视觉规范

| 剩余时间 | 颜色 | 行为        | 实现说明                               |
| -------- | ---- | ----------- | -------------------------------------- |
| >30s     | 白色 | 稳定显示    | 正常状态，无动画                       |
| 30–10s   | 黄色 | 呼吸缩放    | 使用 `wx.createAnimation` 实现呼吸效果 |
| ≤10s     | 红色 | 跳动 + 震动 | 跳动动画 + `wx.vibrateShort()`         |

### 4.3 倒计时实现位置

- **WXML**: `chat-room__countdown` / `chat-room__countdown-number`
- **WXSS**: 根据剩余时间动态切换颜色类
- **TS**: `updateCountdown()` 方法，监听倒计时变化并更新样式

---

## 5. 发言舞台区域

### 5.1 默认状态

- **文案**: `点击麦克风开始申冤…`（发言方）或 `等待对方陈述…`（监听方）
- **样式**: 灰色、居中、半透明
- **实现位置**:
    - WXML: `chat-room__stage-hint`
    - WXSS: 灰色半透明文字样式

### 5.2 录音中状态

- **语音识别对话框**: 显示在舞台中间，不遮挡顶部倒计时
- **实时文本显示**: 录音中不断刷新临时识别文本（`speechTextLive`）
- **占位文案**: 当 `speechTextLive` 为空时显示 `正在记录你的申冤内容…`
- **麦克风**: 发光呼吸动画
- **波纹动画**: 仅在无识别文本时显示录音波纹动画
- **实现位置**:
    - WXML: `chat-room__speech-bubble` 对话框容器
    - WXSS: 对话框样式（`chat-room__speech-bubble`、`chat-room__speech-text`）
    - TS: `onRecordStart()` / `onRecordStop()` 方法

### 5.3 录音结束状态

- **最终文本显示**: 显示识别后的最终文本（`speechTextFinal`）
- **只读状态**: 录音结束后对话框为只读状态

### 5.4 识别错误状态

- **错误提示**: 显示 `[本次语音未成功识别]`
- **Toast 提示**: 同时显示 `语音识别失败` 的 Toast 提示

### 5.5 结束条件

- 用户松开麦克风 → 触发 `onRecordStop()`
- 倒计时归零自动结束 → 在倒计时回调中调用 `stopRecording()`
- 阶段切换时 → 清理识别状态

---

## 6. 麦克风按钮设计

### 6.1 状态区分

| 状态   | 表现                   | 实现说明                              |
| ------ | ---------------------- | ------------------------------------- |
| 可发言 | 绿色按钮               | `chat-room__mic--ready` 类            |
| 录音中 | 放大 + 深绿 + 发光呼吸 | `chat-room__mic--recording` 类 + 动画 |
| 禁用   | 灰色不可点             | `chat-room__mic--disabled` 类         |

### 6.2 交互反馈

- **按下**: 短震动 `wx.vibrateShort()`
- **松开**: 回弹动画（使用 `wx.createAnimation`）
- **实现位置**:
    - WXML: `chat-room__mic-button`
    - TS: `onMicPress()` / `onMicRelease()` 方法

### 6.3 录音与语音识别集成

#### 6.3.1 微信同声传译插件（WechatSI）

**必须使用方案A：WechatSI插件**

- 不使用云函数、第三方ASR、数据库
- 插件配置：在 `app.json` 中添加插件配置
    ```json
    {
        "plugins": {
            "WechatSI": {
                "version": "0.3.0",
                "provider": "wx069ba97219f66d99"
            }
        }
    }
    ```

#### 6.3.2 录音与识别同步启停

**开始录音时（`startRecording()`）**:

1. 清空识别状态：`speechTextLive = ''`, `speechTextFinal = ''`, `recognizeError = null`
2. 启动录音管理器：`recorderManager.start(...)`
3. 同步启动识别管理器：`recognizeManager.start({ lang: "zh_CN" })`
4. 更新状态：`isRecording: true`, `isRecognizing: true`

**停止录音时（`stopRecording()`）**:

1. 停止录音管理器：`recorderManager.stop()`
2. 停止识别管理器：`recognizeManager.stop()`（会触发 `onStop` 回调）
3. 更新状态：`isRecording: false`
4. `onStop` 回调会将最终文本写入 `speechTextFinal`

#### 6.3.3 识别回调处理

**实时识别回调（`onRecognize`）**:

- 接收参数：`res.result` 为临时识别文本（会持续变化）
- 处理：实时更新 `speechTextLive`，显示在对话框

**识别结束回调（`onStop`）**:

- 接收参数：`res.result` 为最终文本
- 处理：更新 `speechTextFinal` 和 `speechTextLive`，设置 `isRecognizing: false`

**识别错误回调（`onError`）**:

- 处理：设置 `recognizeError: '识别失败'`，显示 Toast 提示，设置 `isRecognizing: false`

#### 6.3.4 状态清理

**阶段切换时**:

- 强制停止录音和识别（如果正在进行）
- 清理识别状态：`speechTextLive = ''`, `speechTextFinal = ''`, `recognizeError = null`, `isRecognizing = false`

**页面隐藏/卸载时**:

- 在 `cleanup()` 方法中停止录音和识别
- 清理识别状态

---

## 7. 表情互动系统

### 7.1 使用规则

- **仅监听方可操作** - 通过角色判断显示/隐藏表情按钮面板
- **不影响发言流程** - 表情发送不中断录音或倒计时
- **不显示「对方正在听」文案** - 通过视觉状态传达

### 7.2 表情展示

- **形式**: 弹幕 / 飞行物形式
- **生命周期**: 3–5 秒后自动消失
- **位置**: 不遮挡倒计时（z-index 控制）
- **实现位置**:
    - WXML: `chat-room__emoji-display` 容器
    - TS: `showEmoji(emoji: string)` 方法，创建表情动画实例

### 7.3 表情按钮面板

- **显示条件**: `currentRole === 'listener'` 且 `isMyTurn === false`
- **表情列表**: 常用表情（😊 😢 😡 👍 👎 等）
- **实现位置**:
    - WXML: `chat-room__emoji-panel`
    - TS: `onEmojiTap(emoji: string)` 方法

---

## 8. 状态流转

### 8.1 状态枚举

```typescript
type ChatRoomState =
    | 'waiting' // 等待开始
    | 'speaker_turn' // 当前用户发言轮次
    | 'listener_turn' // 当前用户监听轮次
    | 'completed'; // 双方完成发言
```

### 8.2 状态流转图

```
进入页面
 → waiting（等待双方就绪）
 → speaker_turn（当前用户发言）
   → 倒计时开始
   → 用户点击麦克风开始录音
   → 倒计时结束或用户松开 → 停止录音
 → listener_turn（当前用户监听）
   → 对方发言倒计时
   → 可发送表情互动
 → 双方完成 → completed
 → 跳转至 AI 分析页
```

### 8.3 状态管理实现

- **TS**: `data.state: ChatRoomState` 存储当前状态
- **状态切换**: `switchState(newState: ChatRoomState)` 方法
- **状态同步**: 通过 WebSocket 同步双方状态

---

## 9. WebSocket 集成

### 9.1 消息类型

**客户端 → 服务器**:

| 消息类型          | 说明                                           |
| ----------------- | ---------------------------------------------- |
| `CHAT_SEND`       | 发送文本消息（调试/测试用）                    |
| `ASR_TEXT_PUSH`   | 推送 ASR 识别文本（partial 节流 + final 即时） |
| `EMOJI_SEND`      | 发送表情互动                                   |
| `SPEECH_TURN_END` | 通知服务器本玩家发言结束                       |

**服务器 → 客户端**:

| 消息类型             | 说明                           |
| -------------------- | ------------------------------ |
| `CHAT_RECEIVE`       | 接收对方文本消息               |
| `ASR_TEXT`           | 接收对方的 ASR 实时文本        |
| `EMOJI_RECEIVE`      | 接收对方发送的表情互动         |
| `SPEECH_TURN_SWITCH` | 第一位发言者结束，通知切换轮次 |
| `CHAT_COMPLETE`      | 双方均已结束，触发 AI 判决生成 |

### 9.2 生命周期管理

- **onLoad**: 解析 URL 参数（`roomCode`、`role`、`opponentName`），初始化 WebSocket 连接，注册消息监听
- **onShow**: 恢复页面状态，检查连接状态
- **onUnload**: 取消 WebSocket 监听，关闭连接

**URL 参数说明**:

| 参数           | 类型     | 说明                                                     |
| -------------- | -------- | -------------------------------------------------------- |
| `roomCode`     | `string` | 房间 ID（来自 drum-room 跳转）                           |
| `role`         | `string` | 当前用户角色（`host` / `guest`）                         |
| `opponentName` | `string` | 对手昵称（`encodeURIComponent` 编码，由 drum-room 传入） |

`opponentName` 用于 `buildListenerHints(name)` 生成含对方姓名的监听提示文案（如「静听{对方}发言中…」），替代原先的静态文案数组。

---

## 10. 异常处理

| 场景       | 处理方式                     | 实现位置                    |
| ---------- | ---------------------------- | --------------------------- |
| 发言方掉线 | 判定放弃，自动切换到下一轮次 | `handleUserOffline()` 方法  |
| 录音失败   | 标记为空发言，继续流程       | `handleRecordError()` 方法  |
| 网络异常   | 提示后继续流程，尝试重连     | `handleNetworkError()` 方法 |
| 倒计时异常 | 重置倒计时，重新开始当前轮次 | `resetCountdown()` 方法     |

---

## 11. 动画实现规范

### 11.1 倒计时动画

- **呼吸效果（30-10s）**: 使用 `wx.createAnimation` 实现 scale 循环
- **跳动效果（≤10s）**: 使用 `wx.createAnimation` 实现 translateY 循环
- **颜色过渡**: 通过动态类名切换实现

### 11.2 麦克风动画

- **发光效果**: 使用 `wx.createAnimation` 实现 opacity 和 scale 变化
- **呼吸效果**: 录音中持续循环的缩放动画

### 11.3 表情动画

- **弹幕效果**: 使用 `wx.createAnimation` 实现从底部到顶部的移动
- **生命周期**: 3-5 秒后自动移除动画实例

### 11.4 语音识别对话框动画

- **对话框显示**: 使用 `wx:if` 控制显示/隐藏，无需动画
- **文本更新**: 通过 `setData` 实时更新 `speechTextLive`，文本自动刷新

---

## 12. 语音识别功能实现

### 12.1 数据字段

在 `Page data` 中新增以下字段：

| 字段名            | 类型             | 说明                     |
| ----------------- | ---------------- | ------------------------ |
| `speechTextLive`  | `string`         | 录音中不断刷新的临时文本 |
| `speechTextFinal` | `string`         | 本轮结束后的最终文本     |
| `isRecognizing`   | `boolean`        | 是否识别中               |
| `recognizeError`  | `string \| null` | 识别错误信息             |

### 12.2 识别管理器初始化

在页面实例上挂载 `recognizeManager: IRecordRecognitionManager | null`

在 `onLoad` 中初始化：

```typescript
this.recognizeManager = plugin.getRecordRecognitionManager();
this.initSpeechRecognitionCallbacks();
```

### 12.3 对话框显示规则

**显示条件**: `isRecording === true` 或 `speechTextFinal` 有值 或 `recognizeError` 存在

**显示内容**:

1. `isRecording === true`:
    - 优先显示 `speechTextLive`
    - 若 `speechTextLive` 为空：显示 `正在记录你的申冤内容…`（占位文案样式）
2. `isRecording === false` 且 `speechTextFinal` 有值:
    - 显示 `speechTextFinal`（只读）
3. `recognizeError` 存在:
    - 显示 `[本次语音未成功识别]`（错误样式）

**注意事项**:

- 对话框不遮挡顶部倒计时
- 监听方看到的是 `等待对方陈述…`（原本舞台提示文案），对话框区域可为空或展示对方的文本（本阶段先不实现对方文本同步）

### 12.4 对话框样式规范

**对话框容器** (`chat-room__speech-bubble`):

- `max-width: 620rpx`
- `padding: 32rpx`
- `border-radius: 28rpx`
- `background-color: rgba(0, 0, 0, 0.45)`
- `border: 6rpx solid rgb(0, 0, 0)`
- `box-shadow: 0 16rpx 32rpx rgba(0,0,0,0.35)`

**文本样式** (`chat-room__speech-text`):

- `color: rgb(255, 255, 255)`
- `font-size: 30rpx`
- `line-height: 1.6`
- `word-break: break-all`
- `text-align: center`

**占位文案样式** (`chat-room__speech-text--placeholder`):

- `color: rgb(220, 220, 220)`
- `opacity: 0.9`

**错误文案样式** (`chat-room__speech-text--error`):

- `color: rgb(255, 200, 200)`
- `opacity: 0.9`

### 12.5 验收标准

- [ ] 仅使用 WechatSI 插件识别（`requirePlugin("WechatSI")`）
- [ ] 按住麦克风说话时，对话框文字会实时刷新（`speechTextLive`）
- [ ] 松开/倒计时结束后，对话框显示最终文字（`speechTextFinal`）
- [ ] 识别失败会显示兜底文案且 toast 提示
- [ ] 不影响原有倒计时与阶段切换
- [ ] 阶段切换时正确清理识别状态

---

## 13. 埋点建议

| 事件名                       | 说明                       | 触发时机           |
| ---------------------------- | -------------------------- | ------------------ |
| `chat_room_enter`            | 进入对簿公堂页面           | `onLoad`           |
| `speech_start`               | 开始发言                   | 点击麦克风开始录音 |
| `speech_end`                 | 结束发言                   | 松开麦克风或超时   |
| `speech_recognition_success` | 语音识别成功               | `onStop` 回调      |
| `speech_recognition_error`   | 语音识别失败               | `onError` 回调     |
| `emoji_send`                 | 发送表情                   | 点击表情按钮       |
| `countdown_warning`          | 倒计时进入警告阶段（≤10s） | 倒计时 ≤ 10s       |
| `speech_timeout`             | 发言超时                   | 倒计时归零未发言   |

---

## 14. 验收标准

### P0（必须通过）

- [ ] 倒计时正确显示，颜色和动画根据剩余时间变化
- [ ] 麦克风按钮状态正确切换（可发言/录音中/禁用）
- [ ] 录音功能正常，可以开始和停止录音
- [ ] 语音识别功能正常，实时文本和最终文本正确显示
- [ ] 双方轮流发言流程正确
- [ ] 表情互动功能正常（仅监听方可用）
- [ ] 状态同步正确（WebSocket）

### P1（体验优化）

- [ ] 倒计时动画流畅，无卡顿
- [ ] 麦克风按钮反馈明显（震动、动画）
- [ ] 语音识别对话框不遮挡倒计时
- [ ] 表情弹幕不遮挡倒计时
- [ ] 异常场景有明确提示

---

## 15. 实现状态

### 当前状态（2026-01-24）

- ✅ **已完成** - 基础布局和倒计时实现
- ✅ **已完成** - 麦克风按钮和录音功能
- ✅ **已完成** - 表情互动系统
- ✅ **已完成** - 微信同声传译插件集成（WechatSI）
- ✅ **已完成** - 消息发送与接收（使用 chat-service）
- ⏳ **待对接** - WebSocket 后端完整流程（状态同步、语音消息）
- ⏳ **待完善** - 异常处理和优化

### 后续规划

1. ✅ **第一阶段**: 基础布局和倒计时实现
2. ✅ **第二阶段**: 麦克风按钮和录音功能
3. ✅ **第三阶段**: 表情互动系统
4. ✅ **第四阶段**: 语音识别功能（WechatSI插件）
5. ✅ **第五阶段**: 文本消息发送与接收（chat-service）
6. ⏳ **第六阶段**: WebSocket 后端完整流程对接
7. ⏳ **第七阶段**: 异常处理和优化

---

## 16. 相关文件一览

- **页面实现**:
    - 结构: `miniprogram/packageB/pages/chat-room/index.wxml`
    - 样式: `miniprogram/packageB/pages/chat-room/index.wxss`
    - 逻辑: `miniprogram/packageB/pages/chat-room/index.ts`
    - 配置: `miniprogram/packageB/pages/chat-room/index.json`
- **服务层**:
    - WebSocket 管理: `miniprogram/services/websocket-manager.ts`
    - Chat 服务: `miniprogram/services/chat-service.ts`
    - ASR 服务: `miniprogram/services/asr-service.ts`
- **类型定义**:
    - 消息模型: `miniprogram/models/message.ts`
    - Chat WebSocket: `miniprogram/types/chat-websocket.ts`
    - WebSocket 通用: `miniprogram/types/websocket-common.ts`
- **插件配置**:
    - 全局配置: `miniprogram/app.json`（WechatSI 插件配置）
- **录音与识别**:
    - 录音管理器: 使用 `wx.getRecorderManager()`
    - 语音识别: 使用微信同声传译插件（WechatSI）
- **产品文档**:
    - 原始 PRD: `Chat_Room_PRD_v1.0.md`
    - 本实现文档: `docs/miniprogram/chat-room.md`
    - 服务层说明: `docs/miniprogram/services.md`

---

## 17. 设计原则总结

1. **视觉即状态** - 通过倒计时与动画体现阶段，减少文字说明
2. **单一视觉焦点** - 顶部仅保留居中倒计时
3. **强舞台感** - 发言者处于"公堂中央"，语音识别对话框居中显示
4. **娱乐化优先** - 避免严肃审讯感
5. **实时反馈** - 语音识别实时显示，增强交互体验
