# Drum Room（震天鼓抢麦）页面文档

基于《Drum Room（震天鼓抢麦）PRD v1.0》梳理的实现文档，对应页面代码位于：

- `miniprogram/pages/drum-room/index.json`
- `miniprogram/pages/drum-room/index.wxml`
- `miniprogram/pages/drum-room/index.wxss`
- `miniprogram/pages/drum-room/index.ts`

本文档用于在产品、设计、前端之间对齐「Drum Room」的目标、布局和交互细节。

---

## 1. 页面基本信息

| 项目     | 说明                            |
| -------- | ------------------------------- |
| 页面名称 | Drum Room（震天鼓抢麦）         |
| 页面路径 | `/pages/drum-room/index`        |
| 页面类型 | 抢先发言权对抗模块              |
| 进入方式 | Waiting Room 双方就位后自动跳转 |
| 退出方式 | 抢麦结束后自动跳转至 Chat Room  |
| 设计风格 | 强视觉、强动效、强节奏          |
| 优先级   | P0（主流程核心）                |

---

## 2. 页面目标（Why）

### 2.1 核心目标

- **情绪升温而非公平竞技** - 通过短时间、高频点击制造情绪释放与戏剧冲突
- **节奏快、理解成本低** - 简单直接的点击竞争，无需复杂规则说明
- **结果明确、不可逆** - 用"抢麦"而非理性规则决定谁先申冤

### 2.2 用户心理状态

- 情绪：紧张、兴奋、想要抢先表达
- 行为：会疯狂点击按钮，关注对方进度
- 风险：
    - 倒计时不同步导致体验差
    - 网络延迟导致点击无效
    - 不清楚当前状态（谁领先）

---

## 3. 进入流程（含 3 秒倒计时）

### 3.1 进入条件

- 双方已在 Waiting Room 匹配成功
- 房间状态同步完成（WebSocket Ready）

### 3.2 页面进入流程

```
Waiting Room
→ 进入 Drum Room
→ 3 秒进入倒计时（强提示）
→ 开始 5 秒抢麦点击
```

### 3.3 进入倒计时设计（3s）

- **倒计时**：3 → 2 → 1
- **不可跳过** - 双方强制同步
- **倒计时结束瞬间解锁点击**

**倒计时文案**：

> 准备击鼓抢麦

**实现位置**：

- WXML: `drum-room__countdown-prepare`
- TS: `startPrepareCountdown()` 方法
- 使用 `wx.createAnimation` 实现倒计时动画

---

## 4. 页面整体结构

```
┌─────────────────────────────┐
│   震天鼓抢麦                │  ← 页面标题
│   剩余时间：5 秒            │  ← 抢麦倒计时
│ ─────────────────────────── │
│  玩家A进度条   玩家B进度条  │  ← 双方进度条
│  😠 0             0 😈      │  ← 玩家头像和分数
│                              │
│          【 冤 】             │  ← 震天鼓按钮
│                              │
│  5秒内疯狂点击！             │  ← 提示文案
│  谁点得多谁先冤！            │
└─────────────────────────────┘
```

---

## 5. 视觉设计规范

### 5.1 页面背景

```css
background: linear-gradient(
    135deg,
    #ff2e63 0%,
    #ff4d8d 35%,
    #ff8a5b 70%,
    #ffc75f 100%
);
```

**实现位置**：

- WXSS: `drum-room__container` 类

### 5.2 顶部标题

**文案**：`震天鼓抢麦`

**样式**：

```css
font-size: 40rpx;
font-weight: 800;
color: #ffffff;
text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.35);
```

**实现位置**：

- WXML: `drum-room__title`
- WXSS: `drum-room__title` 类

### 5.3 剩余时间显示

**样式**：

```css
font-size: 56rpx;
font-weight: 900;
color: #ffe66d;
```

**实现位置**：

- WXML: `drum-room__countdown`
- WXSS: `drum-room__countdown` 类
- TS: `updateCountdown()` 方法，每秒更新

### 5.4 双方进度条

**容器样式**：

```css
height: 20rpx;
border-radius: 10rpx;
background: rgba(0, 0, 0, 0.25);
border: 4rpx solid #000000;
```

**填充色**：

- 玩家A填充色：`#4D96FF`
- 玩家B填充色：`#FF006E`

**实现位置**：

- WXML: `drum-room__progress-bar` / `drum-room__progress-fill`
- WXSS: `drum-room__progress-bar` / `drum-room__progress-fill` 类
- TS: `updateProgress()` 方法，根据分数更新进度条宽度

---

## 6. 核心交互：震天鼓按钮

### 6.1 外观

**尺寸和样式**：

```css
width: 280rpx;
height: 280rpx;
border-radius: 50%;
background: radial-gradient(circle at top, #ff3b3b, #b80000);
border: 10rpx solid #ffd93d;
box-shadow:
    0 0 0 10rpx rgba(255, 217, 61, 0.3),
    0 20rpx 40rpx rgba(0, 0, 0, 0.4);
```

**按钮文字**：`冤`

**文字样式**：

```css
font-size: 96rpx;
font-weight: 900;
color: #ffd93d;
text-shadow: 0 6rpx 0 #8b0000;
```

**实现位置**：

- WXML: `drum-room__drum-button`
- WXSS: `drum-room__drum-button` 类

### 6.2 点击反馈规则

每一次点击触发以下反馈（按顺序）：

1. **按钮缩放动画** - `scale(0.92)` 使用 `wx.createAnimation`
2. **屏幕轻微抖动** - 使用 `wx.createAnimation` 实现页面抖动
3. **播放鼓声音效** - 使用 `wx.createInnerAudioContext()` 播放音效
4. **震动反馈** - `wx.vibrateShort()`
5. **分数 +1** - 更新本地分数并发送到服务端
6. **随机飞字** - 显示随机文案：`冤啊` / `不服` / `离谱` / `太过分了`

**实现位置**：

- TS: `onDrumClick()` 方法
- 飞字动画：`showFlyingText(text: string)` 方法
- 音效：`playDrumSound()` 方法

### 6.3 按钮状态

| 状态   | 表现                 | 实现说明              |
| ------ | -------------------- | --------------------- |
| 准备中 | 禁用状态（灰色）     | 3秒倒计时期间不可点击 |
| 可点击 | 正常状态（红色渐变） | 5秒抢麦期间可点击     |
| 已结束 | 禁用状态（灰色）     | 5秒倒计时结束后锁定   |

---

## 7. 游戏状态机与胜负规则

### 7.1 状态枚举

```typescript
type TGamePhase =
    | 'INIT' // 初始化状态
    | 'PREPARE_COUNTDOWN' // 3秒准备倒计时
    | 'RUNNING' // 5秒抢麦中
    | 'RESULT'; // 结果展示
```

### 7.2 状态流转

```
INIT（页面加载）
  → 启动游戏逻辑
  → PREPARE_COUNTDOWN（3秒倒计时，不可点击）
  → onCountdownComplete
  → RUNNING（5秒抢麦，可点击）
  → 倒计时归零或游戏结束
  → RESULT（展示结果2秒）
  → 自动跳转 Chat Room
```

### 7.3 时间规则

- **准备倒计时**：3 秒（不可跳过，使用 countdown 组件）
- **抢麦时间**：5 秒（实时更新倒计时，每 100ms 刷新）
- **结果展示**：2 秒（展示后自动跳转）

### 7.4 判定逻辑

```typescript
if (scoreA > scoreB) {
    winner = A;
} else if (scoreB > scoreA) {
    winner = B;
} else {
    winner = hostRole; // 平局时房主胜
}
```

**实现位置**：

- TS: `_calculateLocalResult()` 方法（本地计算）
- 服务端同步判定结果（待对接）

### 7.5 分数同步

- **本地计数** - 每次点击立即更新本地分数（`onDrumTap()`）
- **批量发送** - 通过 `drumService.queueTap()` 批量发送点击（节流 150ms）
- **实时更新** - 双方分数实时显示在进度条上方

**实现位置**：

- TS: `_queueTap()` / `_flushPendingTaps()` 方法
- 服务层：`drumService.queueTap()` / `drumService.flushPendingTaps()`
- 对手点击：`_handleOpponentTap()` 方法监听 DRUM_TAP 消息

---

## 8. 结果展示

### 8.1 胜者

**文案**：`你抢到了惊堂木！`

**视觉效果**：

- 金色光效动画
- 鼓裂动画（使用 `wx.createAnimation`）
- 自动进入 Chat Room（先发言）

**实现位置**：

- WXML: `drum-room__result--winner`
- TS: `showWinnerResult()` 方法
- 动画：`playWinnerAnimation()` 方法

### 8.2 败者

**文案**：`手速慢了点，先听对方说吧`

**视觉效果**：

- 简单的淡入显示
- 自动进入 Chat Room（监听）

**实现位置**：

- WXML: `drum-room__result--loser`
- TS: `showLoserResult()` 方法

### 8.3 结果展示时长

- 结果展示：2 秒
- 2 秒后自动跳转至 Chat Room

**实现位置**：

- TS: `setTimeout(() => navigateToChatRoom(), 2000)`

---

## 9. 异常与兜底

| 场景         | 处理方式                  | 实现位置                   |
| ------------ | ------------------------- | -------------------------- |
| 一方掉线     | 在线方胜                  | `handleUserOffline()` 方法 |
| 双方 0 点击  | 房主胜                    | `determineWinner()` 方法   |
| 网络延迟     | 本地计数 + 服务端校验     | `sendClickEvent()` 方法    |
| 倒计时不同步 | 以服务端时间为准          | `syncServerTime()` 方法    |
| 点击过快     | 防抖处理（最小间隔 50ms） | `onDrumClick()` 方法       |

---

## 10. 模块衔接

### 10.1 上一页

- **Waiting Room** - 双方就位后自动跳转至 Drum Room

### 10.2 下一页

- **Chat Room（申冤对话）** - 抢麦结束后自动跳转
    - 胜者：先发言
    - 败者：先监听

### 10.3 不可返回

- Drum Room 结束后不可返回
- 使用 `wx.redirectTo()` 跳转，而非 `wx.navigateTo()`

---

## 11. WebSocket 集成

### 11.1 服务引用

Drum Room 使用以下服务层：

- **WebSocket 管理器**: `miniprogram/services/websocket-manager.ts`
    - 职责：维护 WebSocket 连接、心跳、重连
- **Drum 服务**: `miniprogram/services/drum-service.ts`
    - 职责：批量发送点击、接收对手点击、处理游戏结果

### 11.2 消息类型定义

**消息类型枚举** (`types/drum-websocket.ts`):

```typescript
enum EDrumMessageType {
    DrumReady = 'DRUM_READY', // Server -> Client: 房间就绪，同步时间
    DrumStart = 'DRUM_START', // Server -> Client: 游戏开始信号
    DrumTap = 'DRUM_TAP', // 双向: 点击事件
    DrumFinish = 'DRUM_FINISH', // Server -> Client: 游戏结束信号
    DrumResult = 'DRUM_RESULT', // Server -> Client: 最终结果
    PeerLeft = 'PEER_LEFT', // Server -> Client: 对手离开
}
```

### 11.3 消息结构

**DRUM_TAP（点击事件）**:

```typescript
// Client -> Server & Server -> Client
{
    type: 'DRUM_TAP',
    data: {
        roomId: string,
        role: 'A' | 'B',
        delta: number,         // 批量点击次数
        clientTimeMs: number,
    },
    timestamp: number,
}
```

**DRUM_RESULT（游戏结果）**:

```typescript
// Server -> Client
{
    type: 'DRUM_RESULT',
    data: {
        roomId: string,
        scoreA: number,
        scoreB: number,
        winnerRole: 'A' | 'B',
    },
    timestamp: number,
}
```

**PEER_LEFT（对手离开）**:

```typescript
// Server -> Client
{
    type: 'PEER_LEFT',
    data: {
        roomId: string,
        leftRole: 'A' | 'B',
    },
    timestamp: number,
}
```

### 11.4 服务层使用

**初始化**:

```typescript
drumService.initialize(
    roomId,
    selfRole,
    (role, delta) => {
        /* 处理对手点击 */
    },
    winnerRole => {
        /* 处理游戏结果 */
    },
    leftRole => {
        /* 处理对手离开 */
    },
    message => {
        /* 处理错误 */
    }
);
```

**发送点击**:

```typescript
// 点击时调用（自动批量发送）
drumService.queueTap();

// 强制发送（倒计时结束时）
drumService.flushPendingTaps();
```

**清理**:

```typescript
// 页面卸载时
drumService.cleanup();
```

### 11.5 生命周期管理

- **onLoad**:
    - 初始化音效池（预留）
    - 解析页面参数（roomId, selfRole, hostRole, playerNames）
    - 通过 `wsManager.updateCallbacks` 注册 WebSocket 消息回调
    - 启动游戏流程（`_startGame()`）
- **onUnload**:
    - 清理所有定时器（`_clearAllTimers()`）
    - 销毁音效池（`destroyAudioPool()`）
    - 清除 WebSocket 消息回调（`wsManager.updateCallbacks({ onMessage: undefined })`）

---

## 12. 动画实现规范

### 12.1 准备倒计时动画

- **数字变化** - 使用 `wx.createAnimation` 实现缩放和淡入淡出
- **文案显示** - "准备击鼓抢麦" 文案淡入显示

**实现位置**：

- TS: `startPrepareCountdown()` 方法

### 12.2 按钮点击动画

- **缩放效果** - `scale(0.92)` 然后回弹
- **页面抖动** - 轻微 translateX/Y 抖动

**实现位置**：

- TS: `animateButtonClick()` 方法

### 12.3 飞字动画

- **随机位置** - 从按钮周围随机位置飞出
- **向上移动** - 使用 `wx.createAnimation` 实现向上移动并淡出
- **生命周期** - 1-2 秒后自动移除

**实现位置**：

- TS: `showFlyingText(text: string)` 方法
- WXML: `drum-room__flying-text` 动态列表

### 12.4 进度条动画

- **平滑更新** - 使用 `wx.createAnimation` 实现进度条宽度平滑变化

**实现位置**：

- TS: `updateProgress()` 方法

### 12.5 结果展示动画

- **胜者光效** - 金色光效扫过动画
- **鼓裂动画** - 按钮裂开效果（可选）

**实现位置**：

- TS: `playWinnerAnimation()` 方法

---

## 13. 音效实现

### 13.1 鼓声音效

- **触发时机** - 每次点击按钮
- **实现方式** - 使用 `wx.createInnerAudioContext()` 播放音效文件
- **音量控制** - 根据点击频率调整音量（避免过于刺耳）

**实现位置**：

- TS: `playDrumSound()` 方法
- 音效文件：`miniprogram/assets/sounds/drum.mp3`（需添加）

---

## 14. 埋点建议

| 事件名               | 说明                  | 触发时机       |
| -------------------- | --------------------- | -------------- |
| `drum_room_enter`    | 进入抢麦页面          | `onLoad`       |
| `drum_click`         | 点击震天鼓按钮        | 每次点击       |
| `drum_countdown_end` | 抢麦倒计时结束        | 5秒倒计时归零  |
| `drum_winner`        | 抢麦获胜              | 结果判定为胜者 |
| `drum_loser`         | 抢麦失败              | 结果判定为败者 |
| `drum_timeout`       | 抢麦超时（双方0点击） | 5秒内无点击    |

---

## 15. 验收标准

### P0（必须通过）

- [ ] 3秒准备倒计时正确显示，不可跳过
- [ ] 5秒抢麦倒计时正确显示
- [ ] 震天鼓按钮点击反馈正常（动画、震动、音效）
- [ ] 分数实时更新，进度条正确显示
- [ ] 胜负判定正确（分数高者胜，平局房主胜）
- [ ] 结果展示正确，自动跳转至 Chat Room
- [ ] 双方状态同步（WebSocket）

### P1（体验优化）

- [ ] 按钮点击动画流畅，无卡顿
- [ ] 飞字动画效果明显
- [ ] 音效播放正常，不卡顿
- [ ] 进度条更新平滑
- [ ] 异常场景有明确提示
- [ ] 网络延迟时本地计数正常

---

## 16. 实现状态

### 当前状态（2026-01-24）

- ✅ **已完成** - 基础布局和倒计时
    - 页面整体结构（标题、倒计时、进度条、震天鼓按钮）
    - 3秒准备倒计时（使用 countdown 组件）
    - 5秒抢麦倒计时（实时更新，每 100ms 刷新）
- ✅ **已完成** - 震天鼓按钮和点击反馈
    - 按钮缩放动画（`wx.createAnimation`）
    - 容器抖动动画（节流 50ms）
    - 震动反馈（`vibrateShort`）
    - 音效播放（`playDrumSound`）
    - 随机飞字动画（800ms 生命周期）
- ✅ **已完成** - 分数同步和进度条
    - 本地分数实时更新
    - 进度条平滑更新（基于分数比例）
    - 批量发送点击（节流 150ms）
- ✅ **已完成** - 结果展示和跳转
    - 胜负判定逻辑（分数比较，平局房主胜）
    - 结果遮罩层（胜者/败者文案）
    - 2秒后自动跳转至 Chat Room（`wx.redirectTo`）
- ⏳ **待对接** - WebSocket 后端集成
    - 前端已实现消息发送和接收逻辑
    - 后端 drum 消息类型处理待实现
- ⏳ **待完善** - 异常处理和优化
    - 对手掉线处理（已有 PEER_LEFT 监听）
    - 网络延迟兜底策略

### 后续规划

1. ✅ **第一阶段**: 基础布局和倒计时实现
2. ✅ **第二阶段**: 震天鼓按钮和点击反馈
3. ✅ **第三阶段**: 分数同步和进度条
4. ✅ **第四阶段**: 结果展示和跳转
5. ⏳ **第五阶段**: WebSocket 后端对接（后端需实现 drum 消息类型处理）
6. ⏳ **第六阶段**: 异常处理和优化

---

## 17. 相关文件一览

- **页面实现**:
    - 结构: `miniprogram/pages/drum-room/index.wxml`
    - 样式: `miniprogram/pages/drum-room/index.wxss`
    - 逻辑: `miniprogram/pages/drum-room/index.ts`
    - 配置: `miniprogram/pages/drum-room/index.json`
- **组件**:
    - 倒计时组件: `miniprogram/components/countdown/`
- **服务层**:
    - WebSocket 管理: `miniprogram/services/websocket-manager.ts`
    - Drum 服务: `miniprogram/services/drum-service.ts`
- **类型定义**:
    - Drum WebSocket: `miniprogram/types/drum-websocket.ts`
- **工具函数**:
    - 时间同步: `miniprogram/utils/time.ts`
    - 随机工具: `miniprogram/utils/random.ts`
    - 触觉反馈: `miniprogram/utils/haptic.ts`
    - 音效播放: `miniprogram/utils/audio.ts`
- **产品文档**:
    - 原始 PRD: `Drum_Room_PRD_v1.0.md`
    - 本实现文档: `docs/miniprogram/drum-room.md`
    - 服务层说明: `docs/miniprogram/services.md`
- **资源文件**:
    - 音效: 待添加至 `miniprogram/assets/sounds/`

---

## 18. 设计原则总结

1. **情绪升温优先** - 通过快速点击制造紧张感和戏剧冲突
2. **视觉即状态** - 通过进度条和分数直观显示双方状态
3. **强节奏感** - 3秒准备 + 5秒抢麦，节奏紧凑
4. **结果明确** - 胜负判定清晰，不可逆转
5. **强反馈** - 每次点击都有明显的视觉、触觉、听觉反馈
