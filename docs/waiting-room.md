# 房间创建 & 等待页（Waiting Room）文档

基于《页面级 PRD｜房间创建 & 等待页（Waiting Room）》梳理的实现文档，对应页面代码位于：

- `miniprogram/pages/waiting-room/index.json`
- `miniprogram/pages/waiting-room/index.wxml`
- `miniprogram/pages/waiting-room/index.wxss`
- `miniprogram/pages/waiting-room/index.ts`

本文档用于在产品、设计、前端之间对齐「等待页」的目标、布局和交互细节。

---

## 1. 页面基本信息

| 项目     | 说明                                     |
| -------- | ---------------------------------------- |
| 页面名称 | 房间创建 / 等待页（Waiting Room）        |
| 页面路径 | `/pages/waiting-room/index`              |
| 页面类型 | 状态等待页（房间未满）                   |
| 进入方式 | 创建房间成功后自动进入                   |
| 退出方式 | 取消审判 / 房间失效 / 对方进入后自动跳转 |
| 设计风格 | 高饱和撞色、波普漫画风、夸张按钮         |

---

## 2. 页面目标（Why）

### 2.1 核心目标

- **明确告诉用户：房间已创建成功**
- **引导用户邀请对方加入**
- **在等待过程中制造"仪式感 + 情绪张力"**
- **避免用户以为卡住或创建失败**

### 2.2 用户心理状态

- 情绪：有点生气 / 好奇 / 想快点开始
- 行为：会立刻去分享、复制、催对方
- 风险：
    - 等太久 → 退出
    - 不清楚下一步 → 误操作

---

## 3. 页面整体结构

```
┌─────────────────────┐
│      连接「孽缘」     │  ← 页面标题
│                     │
│  [ 发起申冤 ] 按钮     │  ← 创建者主按钮
│                     │
│  [ 加入房间 ] 按钮     │  ← 被邀请者入口
│                     │
└─────────────────────┘
```

> ⚠️ 注意：
> **Waiting Room 是一个"复用页面"**
>
> - 创建者 & 被邀请者看到的是 **同一个页面**
> - 但按钮行为 & 文案不同（由角色决定）

---

## 4. 页面状态设计（核心）

### 4.1 状态枚举

```typescript
type WaitingRoomState =
    | 'created_waiting' // 已创建，等待对方
    | 'joining' // 正在加入房间
    | 'ready' // 双方已就位
    | 'invalid'; // 房间失效
```

### 4.2 状态流转

```
创建者视角：
创建房间成功 → created_waiting → (对方加入) → ready → 跳转准备页

被邀请者视角：
进入页面 → (点击加入) → joining → (加入成功) → ready → 跳转准备页

异常情况：
任何状态 → invalid → Toast 提示 → 返回首页
```

---

## 5. 页面元素详细说明

### 5.1 页面标题区

**文案**：

```
连接「孽缘」
```

**设计要求**：

- 白色粗体
- 黑色偏移投影（制造立体感）
- 允许轻微抖动 / 呼吸动画（可选）

**产品含义**：

- 用「孽缘」替代「房间连接」
- 强化戏剧性，而非技术感

**实现位置**：

- WXML: `waiting-room__title`
- WXSS: 白色字体 + 黑色描边 + 投影效果
- TS: 可绑定动画数据 `titleAnimation`

---

### 5.2 主按钮一：发起申冤（创建者）

#### 5.2.1 显示条件

- 当前用户 = 房主（创建者）
- 房间状态 = `created_waiting`

#### 5.2.2 按钮样式

| 项目     | 说明         |
| -------- | ------------ |
| 背景色   | 高饱和亮黄色 |
| 描边     | 黑色粗边框   |
| 圆角     | 大圆角       |
| 图标     | 📣 喇叭      |
| 文案     | 发起申冤     |
| 文字颜色 | 红色         |

#### 5.2.3 点击行为（重要）

点击后 **不直接开始游戏**，而是触发 **邀请行为**：

```typescript
onClick() {
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  // 或复制房间号 / 分享链接
}
```

#### 5.2.4 分享内容（必须）

- 分享标题：

    ```
    快来公堂对簿！清汤大老爷等你很久了！
    ```

- 分享副标题：

    ```
    点击进入情侣审判 · 是非对错一刀断
    ```

- 分享落地页：
    - 自动进入 waiting-room
    - 带 room_id 参数

**实现位置**：

- WXML: `waiting-room__btn--share` / `waiting-room__btn-share`
- TS: `handleShareRoom()` 方法

---

### 5.3 主按钮二：加入房间（被邀请者）

#### 5.3.1 显示条件

- 当前用户 ≠ 房主
- 通过分享 / 扫码进入

#### 5.3.2 按钮样式

| 项目     | 说明         |
| -------- | ------------ |
| 背景色   | 高饱和亮蓝色 |
| 描边     | 黑色粗边框   |
| 图标     | 🔗 链接      |
| 文案     | 加入房间     |
| 文字颜色 | 白色         |

#### 5.3.3 点击行为

```typescript
onClick() {
  joinRoom(room_id);
}
```

**实现位置**：

- WXML: `waiting-room__btn--join` / `waiting-room__btn-join`
- TS: `handleJoinRoom()` 方法

---

## 6. 状态变化与跳转逻辑（非常关键）

### 6.1 创建者视角

| 事件             | 行为                       |
| ---------------- | -------------------------- |
| 创建房间成功     | 进入 waiting-room          |
| 对方未进入       | 停留本页                   |
| 对方点击加入     | 自动跳转至「准备倒计时页」 |
| 点击取消（可选） | 房间失效，返回首页         |

### 6.2 被邀请者视角

| 事件             | 行为              |
| ---------------- | ----------------- |
| 进入小程序       | 展示 waiting-room |
| 点击「加入房间」 | 调用 joinRoom     |
| 加入成功         | 自动跳转准备页    |
| 房间无效         | Toast + 返回首页  |

### 6.3 跳转目标

双方就位后，自动跳转到：

```
/pages/drum-room/index
```

（Drum Room - 震天鼓抢麦页面，包含 3 秒准备倒计时和 5 秒抢麦竞争）

---

## 7. Loading & 反馈设计

### 7.1 加入房间 Loading

**出现时机**：

- 点击「加入房间」后

**表现形式**：

- 半透明遮罩
- 文案轮播（随机）：
    - "正在敲登闻鼓…"
    - "清汤大老爷翻卷宗中…"
    - "衙役正在核对人犯…"

**实现位置**：

- WXML: `waiting-room__loading` / `waiting-room__loading-text`
- TS: `showLoading()` / `hideLoading()` 方法
- 文案数组：`loadingMessages: string[]`

---

### 7.2 自动跳转反馈

- 双方就位后
- 页面无需用户操作
- 自动进入准备页

**实现位置**：

- TS: `onRoomReady()` 方法，监听 WebSocket 消息或轮询状态

---

## 8. 异常处理

### 8.1 房间不存在 / 已失效

| 场景         | 处理                            |
| ------------ | ------------------------------- |
| room_id 无效 | Toast：`这桩案子已经结了～`     |
| 房间已开始   | Toast：`审判已经开庭，来晚了！` |
| 房间人数已满 | Toast：`公堂只容两人`           |

**实现位置**：

- TS: `handleRoomError(error: RoomError)` 方法
- 使用 `wx.showToast()` 显示错误提示

---

### 8.2 网络异常

- 重试 3 次
- 失败提示：

    ```
    网络开小差了，再试一次吧～
    ```

**实现位置**：

- TS: `retryJoinRoom(maxRetries: number = 3)` 方法

---

## 9. WebSocket 集成

### 9.1 消息监听

Waiting Room 需要监听以下 WebSocket 消息：

```typescript
// 对方加入房间
onMessage('room:joined', data => {
    // 更新状态为 ready
    // 自动跳转准备页
});

// 房间失效
onMessage('room:invalid', data => {
    // 显示错误提示
    // 返回首页
});
```

### 9.2 生命周期管理

- `onLoad`: 初始化房间状态，注册 WebSocket 监听
- `onShow`: 恢复页面状态，检查房间状态
- `onUnload`: 取消 WebSocket 监听，清理定时器

---

## 10. 埋点建议（给后续增长用）

| 事件名            | 说明                  |
| ----------------- | --------------------- |
| waiting_room_view | 进入等待页            |
| click_share       | 点击发起申冤          |
| join_room_success | 成功加入房间          |
| waiting_timeout   | 等待超过 X 分钟未进入 |

**实现位置**：

- TS: `trackEvent(eventName: string, data?: object)` 方法
- 可在 `utils/analytics.ts` 中统一管理

---

## 11. 验收标准（页面级）

### P0（必须通过）

- [ ] 创建房间后必定进入 waiting-room
- [ ] 被邀请者能成功加入
- [ ] 双方进入后自动跳转
- [ ] 房间无效时有明确反馈

### P1（体验）

- [ ] 按钮反馈明显
- [ ] 页面无"卡死感"
- [ ] 文案风格符合产品调性

---

## 12. 产品备注（给开发 / AI）

> Waiting Room **不是一个"空页面"**
> 它承担的是：

- 情绪缓冲
- 邀请引导
- 状态同步

**哪怕逻辑很简单，也必须"看起来很有戏"**

---

## 13. 相关文件一览

- 页面实现：
    - 结构：`miniprogram/pages/waiting-room/index.wxml`
    - 样式：`miniprogram/pages/waiting-room/index.wxss`
    - 逻辑：`miniprogram/pages/waiting-room/index.ts`
    - 配置：`miniprogram/pages/waiting-room/index.json`
- 产品文档：
    - 原始 PRD：页面级 PRD｜房间创建 & 等待页（Waiting Room）
    - 本实现文档：`docs/waiting-room.md`
- 相关服务：
    - WebSocket 管理：`miniprogram/services/websocket.ts`（待实现）
    - 房间服务：`miniprogram/services/room.ts`（待实现）
