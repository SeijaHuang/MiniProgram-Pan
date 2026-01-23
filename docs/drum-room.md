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

## 7. 时间与胜负规则

### 7.1 时间规则

- **准备倒计时**：3 秒（不可跳过）
- **抢麦时间**：5 秒
- **倒计时结束即锁定结果** - 不可再点击

### 7.2 判定逻辑

```typescript
if (scoreA > scoreB) {
    winner = A;
} else if (scoreB > scoreA) {
    winner = B;
} else {
    winner = 房主; // 平局时房主胜
}
```

**实现位置**：

- TS: `determineWinner()` 方法
- 服务端同步判定结果

### 7.3 分数同步

- **本地计数** - 每次点击立即更新本地分数
- **服务端校验** - 通过 WebSocket 发送点击事件，服务端验证并同步
- **实时更新** - 双方分数实时显示在进度条上方

**实现位置**：

- TS: `sendClickEvent()` 方法，发送 WebSocket 消息
- 监听服务端分数同步消息

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

### 11.1 消息类型

```typescript
// 点击事件
{
    type: 'drum:click',
    userId: string,
    timestamp: number,
}

// 分数同步
{
    type: 'drum:score',
    scores: {
        playerA: number,
        playerB: number,
    },
}

// 倒计时同步
{
    type: 'drum:countdown',
    remainingTime: number,
    phase: 'prepare' | 'competing' | 'finished',
}

// 结果判定
{
    type: 'drum:result',
    winner: string,
    scores: {
        playerA: number,
        playerB: number,
    },
}
```

### 11.2 生命周期管理

- **onLoad**: 初始化 WebSocket 连接，注册消息监听，开始准备倒计时
- **onShow**: 恢复页面状态，检查连接状态
- **onUnload**: 取消 WebSocket 监听，清理定时器

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

### 当前状态（2026-01-22）

- ⏳ **待实现** - 基础布局和倒计时
- ⏳ **待实现** - 震天鼓按钮和点击反馈
- ⏳ **待实现** - 分数同步和进度条
- ⏳ **待实现** - 结果展示和跳转
- ⏳ **待实现** - WebSocket 状态同步
- ⏳ **待实现** - 异常处理和优化

### 后续规划

1. ⏳ **第一阶段**: 基础布局和倒计时实现
2. ⏳ **第二阶段**: 震天鼓按钮和点击反馈
3. ⏳ **第三阶段**: 分数同步和进度条
4. ⏳ **第四阶段**: 结果展示和跳转
5. ⏳ **第五阶段**: WebSocket 状态同步
6. ⏳ **第六阶段**: 异常处理和优化

---

## 17. 相关文件一览

- **页面实现**:
    - 结构: `miniprogram/pages/drum-room/index.wxml`
    - 样式: `miniprogram/pages/drum-room/index.wxss`
    - 逻辑: `miniprogram/pages/drum-room/index.ts`
    - 配置: `miniprogram/pages/drum-room/index.json`
- **产品文档**:
    - 原始 PRD: `Drum_Room_PRD_v1.0.md`
    - 本实现文档: `docs/drum-room.md`
- **相关服务**:
    - WebSocket 管理: `miniprogram/services/websocket-manager.ts`
    - 房间服务: `miniprogram/services/room-service.ts`
- **资源文件**:
    - 音效: `miniprogram/assets/sounds/drum.mp3`（需添加）

---

## 18. 设计原则总结

1. **情绪升温优先** - 通过快速点击制造紧张感和戏剧冲突
2. **视觉即状态** - 通过进度条和分数直观显示双方状态
3. **强节奏感** - 3秒准备 + 5秒抢麦，节奏紧凑
4. **结果明确** - 胜负判定清晰，不可逆转
5. **强反馈** - 每次点击都有明显的视觉、触觉、听觉反馈
