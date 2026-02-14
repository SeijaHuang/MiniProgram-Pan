# 组件文档

本目录包含项目中所有自定义组件的详细说明文档。

## 组件列表

### 1. Styled Button（样式化按钮组件）

- **文件路径**: `miniprogram/components/styled-button/`
- **组件名称**: `styled-button`
- **功能**: 可复用的按钮组件，支持多种颜色主题、图标、光线扫过动画效果

#### 属性（Properties）

| 属性名        | 类型    | 默认值 | 必填 | 说明                                                                          |
| ------------- | ------- | ------ | ---- | ----------------------------------------------------------------------------- |
| `text`        | String  | ''     | 是   | 按钮文字内容                                                                  |
| `icon`        | String  | ''     | 否   | 图标（emoji 或文字），显示在文字上方                                          |
| `color`       | String  | 'red'  | 否   | 按钮颜色主题：'red'（红色）、'yellow'（黄色）、'blue'（蓝色）、'grey'（灰色） |
| `showShine`   | Boolean | true   | 否   | 是否显示光线扫过动画效果                                                      |
| `customClass` | String  | ''     | 否   | 自定义 CSS 类名                                                               |
| `buttonStyle` | String  | ''     | 否   | 自定义内联样式                                                                |

#### 事件（Events）

| 事件名 | 说明         | 回调参数 |
| ------ | ------------ | -------- |
| `tap`  | 按钮点击事件 | -        |

#### 使用示例

```xml
<!-- 红色按钮（默认） -->
<styled-button
    text="我要申冤！"
    bindtap="handleStartJudge"
></styled-button>

<!-- 黄色按钮，带图标 -->
<styled-button
    text="发起申冤"
    icon="📣"
    color="yellow"
    bindtap="handleShareRoom"
></styled-button>

<!-- 蓝色按钮 -->
<styled-button
    text="加入房间"
    icon="🔗"
    color="blue"
    bindtap="handleJoinRoom"
></styled-button>
```

#### 样式特性

- **统一设计风格**：
    - 大圆角（24rpx）
    - 黑色粗边框（8rpx，底部 12rpx 加粗）
    - 底部厚度感阴影（8rpx 黑色投影 + 12rpx 16rpx 模糊阴影）
    - 按压反馈：`scale(0.96) + translateY(6rpx)`，阴影变浅

- **颜色主题**：
    - **红色（red）**：红色渐变背景（`#ff3b30 → #e6392e`），白色文字
    - **黄色（yellow）**：亮黄色背景（`#ffd200`），红色文字
    - **蓝色（blue）**：蓝色背景（`#6e95f7`），白色文字
    - **灰色（grey）**：灰色背景（`#666666`），白色文字

- **光线扫过动画**：
    - 持续的光线从左到右扫过按钮表面
    - 3 秒循环，使用 CSS `@keyframes` 实现
    - 可通过 `showShine` 属性关闭

- **图标支持**：
    - 当提供 `icon` 时，图标显示在文字上方
    - 垂直排列布局（`flex-direction: column`）
    - 图标大小：40rpx

#### 使用场景

- 欢迎页主 CTA 按钮（红色）
- 等待页「发起申冤」按钮（黄色）
- 等待页「加入房间」按钮（蓝色）
- 其他需要统一风格的按钮场景

---

### 2. Countdown（倒计时组件）

- **文件路径**: `miniprogram/components/countdown/`
- **组件名称**: `countdown`
- **功能**: 全屏倒计时遮罩组件，用于页面跳转前的倒计时

#### 属性（Properties）

| 属性名     | 类型   | 默认值     | 必填 | 说明                   |
| ---------- | ------ | ---------- | ---- | ---------------------- |
| `duration` | Number | 3          | 否   | 倒计时时长（秒）       |
| `subtext`  | String | '即将开庭' | 否   | 倒计时下方显示的副文案 |

#### 事件（Events）

| 事件名     | 说明             | 回调参数 |
| ---------- | ---------------- | -------- |
| `complete` | 倒计时结束时触发 | -        |

#### 方法（Methods）

| 方法名  | 说明             | 参数 | 返回值 |
| ------- | ---------------- | ---- | ------ |
| `start` | 开始倒计时       | -    | -      |
| `stop`  | 停止并隐藏倒计时 | -    | -      |

#### 使用示例

```xml
<!-- 页面 WXML -->
<countdown
    id="countdown"
    duration="3"
    subtext="即将开庭"
    bindcomplete="onCountdownComplete"
></countdown>
```

```typescript
// 页面 TS
Page({
    // 启动倒计时
    startCountdown(): void {
        const countdownComponent = this.selectComponent('#countdown');
        if (countdownComponent) {
            countdownComponent.start();
        }
    },

    // 倒计时完成回调
    onCountdownComplete(): void {
        console.log('倒计时结束');
        // 执行跳转逻辑
        wx.navigateTo({
            url: '/pages/next-page/index',
        });
    },

    // 停止倒计时
    stopCountdown(): void {
        const countdownComponent = this.selectComponent('#countdown');
        if (countdownComponent) {
            countdownComponent.stop();
        }
    },
});
```

#### 样式特性

- **全屏遮罩**：
    - 黑色半透明背景（`rgba(0, 0, 0, 0.85)`）
    - 覆盖整个屏幕（`position: fixed, z-index: 9999`）
    - 阻止事件穿透（`catchtouchmove`）

- **倒计时数字**：
    - 特大号字体（240rpx）
    - 白色文字 + 黑色描边（8rpx）
    - 右下投影效果（16rpx 20rpx）
    - 缩放入场动画（从 1.5 到 1.0，时长 300ms）

- **副文案**：
    - 亮黄色文字（`#ffe66d`）
    - 字号 32rpx
    - 显示在倒计时数字下方

- **动画效果**：
    - 数字变化时：缩放动画（使用 `wx.createAnimation`）
    - 震动反馈：每秒跳动时触发 `wx.vibrateShort({ type: 'heavy' })`

#### 使用场景

- Waiting Room 双方就位后的倒计时（3秒后跳转 Drum Room）
- Drum Room 准备倒计时（3秒后开始抢麦）
- 其他需要倒计时的页面跳转场景

---

### 3. Styled Title（样式化标题组件）

- **文件路径**: `miniprogram/components/styled-title/`
- **组件名称**: `styled-title`
- **功能**: 可复用的标题组件，支持动画绑定和初始状态控制

#### 属性（Properties）

| 属性名        | 类型    | 默认值 | 必填 | 说明                                           |
| ------------- | ------- | ------ | ---- | ---------------------------------------------- |
| `text`        | String  | ''     | 否   | 标题文字内容                                   |
| `isInitial`   | Boolean | false  | 否   | 是否为初始状态（用于入场动画）                 |
| `animation`   | Object  | {}     | 否   | 动画数据对象（通过 `wx.createAnimation` 创建） |
| `customClass` | String  | ''     | 否   | 自定义 CSS 类名（应用到文字元素）              |

#### 使用示例

```xml
<!-- 基础使用 -->
<styled-title text="判了么"></styled-title>

<!-- 带入场动画 -->
<styled-title
    text="连接「孽缘」"
    isInitial="{{ !isEntranceReady }}"
    animation="{{ titleAnimation }}"
></styled-title>

<!-- 带自定义样式 -->
<styled-title
    text="等待对方加入"
    customClass="waiting-room__title-text"
></styled-title>
```

#### 样式特性

- **统一设计风格**：
    - 大号字体（96rpx）
    - 粗体（font-weight: 700）
    - 白色文字（`#ffffff`）
    - 黑色描边（四周 3rpx）
    - 右下角黑色投影（8rpx 10rpx）

- **动画支持**：
    - 通过 `animation` 属性绑定 `wx.createAnimation` 创建的动画数据
    - 支持初始状态（`isInitial`）：初始时缩小、旋转、透明，用于入场动画
    - 动画通过 `wx.createAnimation` API 实现，符合项目规范

#### 使用场景

- 欢迎页主标题「判了么」
- 等待页标题「连接「孽缘」」
- 其他需要统一风格的页面标题

---

### 4. Avatar（头像组件）

- **文件路径**: `miniprogram/components/avatar/`
- **组件名称**: `avatar`
- **功能**: 圆形头像组件，支持入场动画、呼吸动画和徽标

#### 属性（Properties）

| 属性名          | 类型    | 默认值 | 必填 | 说明             |
| --------------- | ------- | ------ | ---- | ---------------- |
| `src`           | String  | ''     | 否   | 头像图片 URL     |
| `badge`         | String  | '👑'   | 否   | 徽标 emoji       |
| `size`          | Number  | 220    | 否   | 头像直径（rpx）  |
| `playEntrance`  | Boolean | false  | 否   | 是否触发入场动画 |
| `entranceDelay` | Number  | 0      | 否   | 入场延迟（ms）   |
| `breathing`     | Boolean | true   | 否   | 是否启用呼吸动画 |

#### 动画效果

- **入场动画**: `wx.createAnimation()` 实现 scale + fade-in（600ms）
- **呼吸动画**: 周期性 scale 缩放（1.0 ↔ 1.3，间隔 1500ms）

---

### 5. Radar Chart（六维战力雷达图）

- **文件路径**: `miniprogram/components/radar-chart/`
- **组件名称**: `radar-chart`
- **功能**: 基于 Canvas 2D 绘制的六维战力雷达图，用于判决书页面展示双方对战数据

#### 属性（Properties）

| 属性名        | 类型   | 默认值 | 必填 | 说明                                |
| ------------- | ------ | ------ | ---- | ----------------------------------- |
| `hostScores`  | Object | {}     | 否   | 玩家1的六维分数（IDimensionScores） |
| `guestScores` | Object | {}     | 否   | 玩家2的六维分数（IDimensionScores） |
| `size`        | Number | 500    | 否   | 图表尺寸（rpx）                     |

#### 方法（Methods）

| 方法名 | 说明                     | 参数 | 返回值 |
| ------ | ------------------------ | ---- | ------ |
| `draw` | 绘制雷达图（含展开动画） | -    | -      |

#### 六维指标

嘴硬程度、翻旧账、逻辑滑坡、撒娇暴击、求生欲、受害者演技

#### 使用示例

```xml
<radar-chart
    id="radarChart"
    hostScores="{{ verdict.battleStats.host }}"
    guestScores="{{ verdict.battleStats.guest }}"
    size="{{ 500 }}"
></radar-chart>
```

```typescript
// 页面 onReady 后调用
const radarChart = this.selectComponent('#radarChart');
if (radarChart) {
    (radarChart as Record<string, () => void>).draw();
}
```

---

### 6. Secret Modal（密折弹窗）

- **文件路径**: `miniprogram/components/secret-modal/`
- **组件名称**: `secret-modal`
- **功能**: 底部弹出半屏面板，显示当前玩家的私密反馈（封号 + 锦囊妙计）

#### 属性（Properties）

| 属性名         | 类型    | 默认值 | 必填 | 说明         |
| -------------- | ------- | ------ | ---- | ------------ |
| `visible`      | Boolean | false  | 否   | 是否显示弹窗 |
| `title`        | String  | ''     | 否   | 封号名称     |
| `advice`       | String  | ''     | 否   | 锦囊妙计文案 |
| `topDimension` | String  | ''     | 否   | 最高维度名称 |
| `topScore`     | Number  | 0      | 否   | 最高维度分数 |

#### 事件（Events）

| 事件名  | 说明         | 回调参数 |
| ------- | ------------ | -------- |
| `close` | 关闭弹窗事件 | -        |

#### 动画效果

- 从底部滑入/滑出（`wx.createAnimation()`，400ms）
- 点击遮罩层或关闭按钮触发关闭

---

### 7. Post Game Effect（赛后互动特效）

- **文件路径**: `miniprogram/components/post-game-effect/`
- **组件名称**: `post-game-effect`
- **功能**: 全屏覆盖层特效组件，用于赛后互动的视觉反馈

#### 属性（Properties）

| 属性名   | 类型   | 默认值 | 必填 | 说明                                       |
| -------- | ------ | ------ | ---- | ------------------------------------------ |
| `effect` | String | ''     | 否   | 特效类型：`'stamp_death'` 或 `'beg_emoji'` |

#### 特效类型

- **`stamp_death`**（执行惩戒）: 「卒」字从大缩小 + 淡入 + 长震动
- **`beg_emoji`**（跪地求饶）: emoji 从下方浮入 + 淡入 + 短震动

#### 动画效果

- 所有动画使用 `wx.createAnimation()` 实现
- 特效持续 2000ms 后自动消失
- 配合 `wx.vibrateLong()` / `wx.vibrateShort()` 震动反馈

---

## 组件开发规范

### 文件结构

每个组件包含 4 个文件：

```
components/
└── component-name/
    ├── index.json    # 组件配置（component: true）
    ├── index.wxml    # 组件模板
    ├── index.wxss    # 组件样式
    └── index.ts      # 组件逻辑（Component({ ... })）
```

### 样式隔离

组件使用 `styleIsolation: "apply-shared"`，允许外部样式影响组件内部，同时保持组件样式相对独立。

### 命名规范

- **组件目录名**：kebab-case（如 `styled-button`）
- **组件类名**：BEM 命名规范（如 `.styled-button__content`）
- **属性名**：camelCase（如 `showShine`）

### 动画实现

- **必须使用 `wx.createAnimation` API**，不使用 CSS 动画（符合项目规范）
- 组件通过 `animation` 属性接收外部传入的动画数据
- 入场动画由父页面统一调度和管理

### 类型定义

组件属性应使用 TypeScript 类型定义（在 `index.ts` 中）：

```typescript
Component({
    properties: {
        text: {
            type: String,
            value: '',
            required: true,
        },
        // ...
    },
});
```

---

## 相关文件

- **组件实现**：
    - `miniprogram/components/styled-button/` - 样式化按钮
    - `miniprogram/components/countdown/` - 倒计时组件
    - `miniprogram/components/styled-title/` - 样式化标题
    - `miniprogram/components/avatar/` - 头像组件
    - `miniprogram/components/radar-chart/` - 六维战力雷达图
    - `miniprogram/components/secret-modal/` - 密折弹窗
    - `miniprogram/components/post-game-effect/` - 赛后互动特效
- **使用示例**：
    - `miniprogram/pages/welcome/index.wxml` - 使用 styled-button、styled-title
    - `miniprogram/packageA/pages/waiting-room/index.wxml` - 使用 styled-button、countdown、avatar
    - `miniprogram/packageA/pages/drum-room/index.wxml` - 使用 countdown
    - `miniprogram/packageB/pages/verdict/index.wxml` - 使用 styled-button、radar-chart、secret-modal、post-game-effect
- **开发规范**：
    - `../../CLAUDE.md` - 项目开发规范
    - `../../README.md` - 项目主文档
- **产品文档**：
    - `./README.md` - 文档索引
    - 各页面文档中均有组件使用说明
