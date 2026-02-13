# Verdict（清汤大老爷判决书）页面文档

基于《判决书页面（Verdict Page）详细 PRD v1.0》梳理的实现文档，对应页面代码位于：

- `miniprogram/packageB/pages/verdict/verdict.json`
- `miniprogram/packageB/pages/verdict/verdict.wxml`
- `miniprogram/packageB/pages/verdict/verdict.wxss`
- `miniprogram/packageB/pages/verdict/verdict.ts`

本文档用于在产品、设计、前端之间对齐「Verdict（判决书）」的目标、布局和交互细节。

---

## 1. 页面基本信息

| 项目     | 说明                                                    |
| -------- | ------------------------------------------------------- |
| 页面名称 | Verdict（清汤大老爷判决书）                             |
| 页面路径 | `packageB/pages/verdict/verdict`                        |
| 所属子包 | packageB                                                |
| 页面类型 | 核心产出页面 — AI 判决结果可视化                        |
| 进入方式 | verdict-waiting 页面收到 `VERDICT_RESULT` 后 redirectTo |
| 退出方式 | 赛后互动完成后跳转回首页 / 直接退出                     |
| 设计风格 | 波普风高饱和撞色、搞笑夸张的视觉风格，长滚动卡片布局    |
| 优先级   | P0（主流程核心页面）                                    |

---

## 2. 页面目标（Why）

### 2.1 核心目标

1. **以搞笑夸张的视觉风格呈现 AI 判决结果** - 制造"爆笑感"，增强分享欲望
2. **清晰传达多维判决信息** - 责任分布、六维战力图、判官点评、惩罚令牌
3. **提供密折入口（个人私密反馈）** - 每位用户仅可查看自己的密折
4. **支持赛后互动和判决书保存** - 赢家/输家按钮互动 + 保存图片到相册

### 2.2 用户心理状态

- 情绪：好奇、期待、想看结果、想分享
- 行为：会从上到下浏览完整判决内容，关注自己的得分和惩罚，可能截图或保存分享
- 风险：
    - 数据加载失败导致空白页
    - 雷达图 Canvas 渲染失败
    - 赛后互动 WebSocket 断连

---

## 3. 进入条件

- verdict-waiting 页面收到后端 AI 分析结果（WebSocket 消息 `VERDICT_RESULT`）
- 页面通过 `wx.redirectTo` 跳转（不可返回 verdict-waiting）
- 通过页面路由参数或全局状态传入 `roomId`

---

## 4. 数据来源

### 4.1 页面入参

通过页面路由 `options` 传入 `roomId`，页面加载时从后端获取完整判决数据。

### 4.2 后端 API

**Endpoint**: `POST /v1/rooms/:roomId/judgments`

**Response 数据结构**:

```typescript
interface IVerdictResult {
    /** 案件编号，5位随机数字 */
    caseNumber: string;
    /** 赢家标识 */
    winnerId: 'host' | 'guest' | null;
    /** 输家标识 */
    loserId: 'host' | 'guest' | null;
    /** 责任分布 */
    responsibility: IResponsibility;
    /** 六维战力图数据 */
    battleStats: IBattleStats;
    /** 大老爷赠言（50-100字） */
    verdictSummary: string;
    /** 惩罚令牌 */
    punishmentTask: IPunishmentTask;
    /** 双方密折（私密，仅各自可见） */
    secretReports: ISecretReports;
}
```

### 4.3 子数据结构定义

```typescript
/** 责任分布 */
interface IResponsibility {
    /** 玩家1(host)责任百分比，0-100 */
    host: number;
    /** 玩家2(guest)责任百分比，0-100 */
    guest: number;
    /** 第三方因素列表 */
    thirdParty: IThirdPartyFactor[];
}

interface IThirdPartyFactor {
    /** 因素名称，如 "水逆影响"、"宇宙射线" */
    reason: string;
    /** 因素百分比，3-15 */
    percentage: number;
    /** 因素 emoji */
    emoji: string;
}
/** 约束: host + guest + sum(thirdParty.percentage) = 100 */

/** 六维战力图 */
interface IBattleStats {
    host: IDimensionScores;
    guest: IDimensionScores;
}

interface IDimensionScores {
    /** 嘴硬程度 0-100 */
    mouthHard: number;
    /** 翻旧账等级 0-100 */
    oldAccountDigging: number;
    /** 逻辑滑坡 0-100 */
    logicSlippery: number;
    /** 撒娇暴击 0-100 */
    charmAttack: number;
    /** 求生欲 0-100 */
    survivalInstinct: number;
    /** 受害者演技 0-100 */
    victimActing: number;
}

/** 惩罚令牌 */
interface IPunishmentTask {
    /** 输家标识 */
    loserId: 'host' | 'guest';
    /** 惩罚任务描述（含 emoji） */
    task: string;
    /** 期限说明 */
    deadline: string;
}

/** 密折 */
interface ISecretReports {
    host: ISecretReport;
    guest: ISecretReport;
}

interface ISecretReport {
    /** 封号标题，如 "嘴硬大魔王" */
    title: string;
    /** 锦囊妙计/建议，50字以内 */
    advice: string;
}
```

---

## 5. 页面整体结构

页面为**纵向长滚动页面**，背景色米白 `#FFFEF7`，左右带装饰性红色竖线边框。各区域以卡片形式排列。

```
┌─────────────────────────────────────┐
│         区域1: 标题区（红色背景）        │
│    清汤大老爷判决书 + 案件编号 + 鸭子图标  │
├─────────────────────────────────────┤
│         区域2: 责任分布                 │
│    玩家1 / 玩家2 / 第三方因素卡片       │
├─────────────────────────────────────┤
│         区域3: 双方六维战力图            │
│    雷达图（Canvas 六边形）              │
├─────────────────────────────────────┤
│         区域4: 大老爷赠言               │
│    清汤大老爷头像 + 赠言文字            │
├─────────────────────────────────────┤
│         区域5: 惩罚令牌                │
│    惩罚内容展示                        │
├─────────────────────────────────────┤
│         区域6: 查看密折按钮             │
│    渐变色按钮（紫→粉）                  │
├─────────────────────────────────────┤
│         区域7: 保存判决书按钮           │
│    黄色按钮 + 红色描边                  │
├─────────────────────────────────────┤
│       （可选）区域8: 赛后互动按钮        │
│    赢家/输家/平局专属按钮               │
└─────────────────────────────────────┘
```

### 5.1 整体视觉风格

| 属性           | 规范                                     |
| -------------- | ---------------------------------------- |
| **背景色**     | `#FFFEF7`（米白）                        |
| **页面边框**   | 左右各 `8rpx` 红色竖线装饰边框 `#FF6B6B` |
| **卡片圆角**   | `16rpx`                                  |
| **卡片间距**   | `24rpx`                                  |
| **卡片内边距** | `32rpx`                                  |
| **卡片背景**   | `#FFFFFF`，`2rpx` 实线边框 `#E8E8E8`     |
| **主字体色**   | `#2D3436`（深灰）                        |
| **标题强调色** | `#D4380D`（中国红）                      |
| **配色方案**   | 波普风高饱和撞色                         |

---

## 6. 区域详细设计

### 6.1 区域1: 标题区

#### 6.1.1 视觉设计

```
╔══════════════════════════════════════════╗
║              🦆 (鸭子图标)                ║
║        清汤大老爷判决书                    ║
║        案件编号: NO.74770                 ║
╚══════════════════════════════════════════╝
```

| 元素         | 样式                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| **背景**     | 纯红色 `#D4380D`，覆盖全宽，高度 `320rpx`                                               |
| **鸭子图标** | 居中，`120rpx × 120rpx`，距顶部 `40rpx`                                                 |
| **标题文字** | "清汤大老爷判决书"，`font-size: 48rpx`，`color: #FFD93D`，`font-weight: bold`，居中     |
| **案件编号** | "案件编号: NO.{caseNumber}"，`font-size: 24rpx`，`color: #FFFFFF`，居中，距标题 `16rpx` |
| **底部圆角** | `border-radius: 0 0 24rpx 24rpx`                                                        |

#### 6.1.2 数据映射

| 字段     | 来源                                               |
| -------- | -------------------------------------------------- |
| 案件编号 | `verdictResult.caseNumber`，格式化为 `NO.{number}` |
| 鸭子图标 | 本地静态资源 `/images/judge-duck.png`              |

#### 6.1.3 入场动画

| 动画           | 实现方式               | 参数                                                  |
| -------------- | ---------------------- | ----------------------------------------------------- |
| 鸭子从上方弹入 | `wx.createAnimation()` | `translateY(-100 → 0)`，`duration: 600ms`，`ease-out` |
| 标题淡入       | `wx.createAnimation()` | `opacity(0 → 1)`，`delay: 300ms`，`duration: 500ms`   |
| 案件编号淡入   | `wx.createAnimation()` | `opacity(0 → 1)`，`delay: 500ms`，`duration: 400ms`   |

**实现位置**：

- WXML: `verdict__header` / `verdict__duck-icon` / `verdict__title` / `verdict__case-number`
- TS: `playHeaderAnimation()` 方法

---

### 6.2 区域2: 责任分布

#### 6.2.1 区域标题

⚖️ + "责任分布"，`font-size: 36rpx`，`color: #D4380D`，`font-weight: bold`，居中。

#### 6.2.2 布局结构

三列水平布局，Flexbox `justify-content: space-between`：

```
┌──────────┐  ┌──────────┐  ┌────────────────┐
│  👨 头像  │  │  👩 头像  │  │  第三方因素      │
│ 玩家1责任  │  │ 玩家2责任  │  │  🌙 水逆 10%   │
│   35%     │  │   45%     │  │  🛸 宇宙射线 10% │
└──────────┘  └──────────┘  └────────────────┘
```

#### 6.2.3 玩家责任卡片

| 元素         | 样式                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| **卡片容器** | `width: 210rpx`，`border-radius: 16rpx`，`border: 2rpx solid #E8E8E8`     |
| **背景色**   | 玩家1 → `#DCE9F5`（淡蓝），玩家2 → `#F5DCE9`（淡粉）                      |
| **头像**     | 圆形 `100rpx × 100rpx`，居中，使用 `avatar` 组件                          |
| **头像边框** | 玩家1 → `4rpx solid #4D96FF`，玩家2 → `4rpx solid #FF69B4`                |
| **角色文字** | "玩家1责任" / "玩家2责任"，`font-size: 22rpx`，`color: #666`，居中        |
| **百分比**   | `font-size: 64rpx`，`font-weight: bold`，`color: #D4380D`，`%` 为 `36rpx` |

#### 6.2.4 第三方因素卡片

| 元素         | 样式                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| **卡片容器** | `width: 240rpx`，`border-radius: 16rpx`，`background: #FFFDE0`（淡黄）  |
| **标题**     | "第三方因素"，`font-size: 24rpx`，`color: #333`，`font-weight: bold`    |
| **因素列表** | 每行 `{emoji} {reason} {percentage}%`，`font-size: 22rpx`，行高 `48rpx` |
| **百分比**   | `color: #D4380D`，`font-weight: bold`，右对齐                           |

#### 6.2.5 数据映射

| UI 元素        | 数据字段                      |
| -------------- | ----------------------------- |
| 玩家1百分比    | `responsibility.host`         |
| 玩家2百分比    | `responsibility.guest`        |
| 第三方因素列表 | `responsibility.thirdParty[]` |
| 因素 emoji     | `thirdParty[].emoji`          |
| 因素名称       | `thirdParty[].reason`         |
| 因素百分比     | `thirdParty[].percentage`     |

#### 6.2.6 入场动画

| 动画                 | 实现方式                  | 参数                                                                        |
| -------------------- | ------------------------- | --------------------------------------------------------------------------- |
| 三张卡片依次从下弹入 | `wx.createAnimation()`    | `translateY(60 → 0) + opacity(0 → 1)`，`duration: 400ms`，delay 0/150/300ms |
| 百分比数字计数动画   | `setInterval` + `setData` | 从 0 递增至目标值，`interval: 30ms`，步长自适应                             |

**实现位置**：

- WXML: `verdict__responsibility` / `verdict__player-card` / `verdict__third-party`
- TS: `playResponsibilityAnimation()` / `animatePercentage()` 方法

---

### 6.3 区域3: 双方六维战力图

#### 6.3.1 区域标题

📊 + "双方六维战力图"，`font-size: 36rpx`，`color: #D4380D`，`font-weight: bold`，居中。

#### 6.3.2 雷达图设计

**实现方式**: 使用微信小程序 Canvas 2D API（`<canvas type="2d">`）。封装为独立组件 `radar-chart`。

**Canvas 尺寸**: `width: 650rpx`，`height: 520rpx`，居中。

**雷达图参数**:

| 参数         | 值                               |
| ------------ | -------------------------------- |
| **中心点**   | Canvas 中心 `(centerX, centerY)` |
| **半径**     | `180rpx`（最外圈）               |
| **层数**     | 4 层（25, 50, 75, 100）          |
| **维度数**   | 6                                |
| **标签位置** | 雷达图外侧，距顶点 `30rpx`       |

**六个维度（顺时针从顶部开始）**:

| 序号 | 维度名     | 角度         | 字段映射            |
| ---- | ---------- | ------------ | ------------------- |
| 1    | 嘴硬程度   | 0°（正上方） | `mouthHard`         |
| 2    | 翻旧账     | 60°          | `oldAccountDigging` |
| 3    | 逻辑滑坡   | 120°         | `logicSlippery`     |
| 4    | 撒娇暴击   | 180°         | `charmAttack`       |
| 5    | 求生欲     | 240°         | `survivalInstinct`  |
| 6    | 受害者演技 | 300°         | `victimActing`      |

**双方数据区域样式**:

| 属性         | 玩家1 (host)                | 玩家2 (guest)             |
| ------------ | --------------------------- | ------------------------- |
| **边框色**   | `#666666`（深灰）           | `#D4380D`（红色）         |
| **填充色**   | `rgba(102, 102, 102, 0.25)` | `rgba(212, 56, 13, 0.25)` |
| **边框宽度** | `3rpx`                      | `3rpx`                    |
| **数据点**   | 圆形 `8rpx` 实心            | 圆形 `8rpx` 实心          |

**图例**: `■ 玩家1    ■ 玩家2`，位于雷达图正下方，`font-size: 22rpx`，水平居中。

#### 6.3.3 Canvas 绘制逻辑

```typescript
function drawRadarChart(
    ctx: CanvasRenderingContext2D,
    options: {
        centerX: number;
        centerY: number;
        radius: number;
        dimensions: string[];
        hostScores: number[]; // 0-100
        guestScores: number[]; // 0-100
    }
): void {
    // 1. 绘制背景网格（4层六边形）
    // 2. 绘制维度轴线（从中心到顶点）
    // 3. 绘制维度标签文字
    // 4. 绘制玩家1数据区域（填充 + 描边）
    // 5. 绘制玩家2数据区域（填充 + 描边）
    // 6. 绘制数据点
    // 7. 绘制图例
}
```

#### 6.3.4 入场动画

| 动画             | 实现方式                               | 参数                                                          |
| ---------------- | -------------------------------------- | ------------------------------------------------------------- |
| 雷达图从中心展开 | Canvas 重绘（`requestAnimationFrame`） | 半径 0 → 目标值，`duration: 800ms`，两方数据间隔 `200ms` 展开 |
| 卡片容器淡入     | `wx.createAnimation()`                 | `opacity(0 → 1)`，`duration: 400ms`                           |

**实现位置**：

- 组件: `miniprogram/components/radar-chart/`
- TS: `drawRadarChart()` / `animateRadarExpand()` 方法

---

### 6.4 区域4: 大老爷赠言

#### 6.4.1 视觉设计

```
╔════════════════════════════════════════╗
║       🦆 大老爷赠言                     ║
║  ┌──────────────────────────────────┐  ║
║  │  "两位施主，此番争执实乃沟通不畅所  │  ║
║  │  致。一方过于理性忽略情感，另一方情  │  ║
║  │  绪先行忘记事实。"                 │  ║
║  └──────────────────────────────────┘  ║
╚════════════════════════════════════════╝
```

#### 6.4.2 样式详情

| 元素         | 样式                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| **外层卡片** | `background: #FFFFFF`，`border-radius: 16rpx`，`border: 2rpx solid #E8E8E8`        |
| **标题栏**   | 🦆 + "大老爷赠言"，`font-size: 34rpx`，`color: #D4380D`，`font-weight: bold`，居中 |
| **赠言容器** | `background: #FFFDE0`，`border-radius: 12rpx`，`border-left: 8rpx solid #FFD93D`   |
| **赠言文字** | 中文引号包裹，`font-size: 28rpx`，`color: #333`，`line-height: 1.8`，左对齐        |
| **引号样式** | `""`，`font-size: 32rpx`，`color: #D4380D`                                         |

#### 6.4.3 数据映射

| UI 元素  | 数据字段                       |
| -------- | ------------------------------ |
| 赠言文字 | `verdictResult.verdictSummary` |

#### 6.4.4 入场动画

| 动画       | 实现方式                  | 参数                                                     |
| ---------- | ------------------------- | -------------------------------------------------------- |
| 打字机效果 | `setInterval` + `setData` | 逐字显示，`interval: 50ms`，显示完毕后引号闪烁一次       |
| 卡片弹入   | `wx.createAnimation()`    | `translateY(40 → 0) + opacity(0 → 1)`，`duration: 500ms` |

**实现位置**：

- WXML: `verdict__summary` / `verdict__summary-text`
- TS: `playTypewriterEffect()` 方法

---

### 6.5 区域5: 惩罚令牌

#### 6.5.1 视觉设计

```
╔════════════════════════════════════════╗
║          ⚔️ 惩罚令牌                    ║
║  输家需连续三天为赢家做早餐，并在每餐前   ║
║  大声说：'您说得对！'                    ║
╚════════════════════════════════════════╝
```

#### 6.5.2 样式详情

| 元素         | 样式                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| **外层卡片** | `background: #FFF0F0`（淡粉），`border-radius: 16rpx`，`border: 2rpx solid #FFCCCC` |
| **标题**     | ⚔️ + "惩罚令牌"，`font-size: 34rpx`，`color: #D4380D`，`font-weight: bold`，居中    |
| **惩罚内容** | `font-size: 28rpx`，`color: #333`，`line-height: 1.8`，居中                         |

#### 6.5.3 数据映射

| UI 元素      | 数据字段                                |
| ------------ | --------------------------------------- |
| 惩罚内容     | `verdictResult.punishmentTask.task`     |
| 期限（可选） | `verdictResult.punishmentTask.deadline` |

#### 6.5.4 入场动画

| 动画     | 实现方式               | 参数                                                          |
| -------- | ---------------------- | ------------------------------------------------------------- |
| 盖章效果 | `wx.createAnimation()` | `scale(3 → 1) + opacity(0 → 1)`，`duration: 300ms`，`ease-in` |
| 配合震动 | `wx.vibrateLong()`     | 盖章动画结束时触发                                            |

**实现位置**：

- WXML: `verdict__punishment`
- TS: `playStampAnimation()` 方法

---

### 6.6 区域6: 查看密折按钮

#### 6.6.1 视觉设计

| 元素         | 样式                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| **按钮高度** | `96rpx`                                                                      |
| **圆角**     | `48rpx`（胶囊形）                                                            |
| **背景**     | `linear-gradient(90deg, #9B59B6 0%, #FF006E 100%)`（紫→粉渐变）              |
| **文字**     | "📋 查看我的密折"，`font-size: 32rpx`，`color: #FFFFFF`，`font-weight: bold` |
| **阴影**     | `box-shadow: 0 8rpx 24rpx rgba(155, 89, 182, 0.4)`                           |

#### 6.6.2 交互行为

点击后弹出**半屏弹窗**（从底部滑入），展示当前用户的密折内容。弹窗滑入使用 `wx.createAnimation()` 实现。

**实现位置**：

- WXML: `verdict__secret-btn`
- TS: `onOpenSecretModal()` 方法

---

### 6.7 区域7: 保存判决书按钮

#### 6.7.1 视觉设计

| 元素         | 样式                                                  |
| ------------ | ----------------------------------------------------- |
| **按钮高度** | `96rpx`                                               |
| **圆角**     | `48rpx`（胶囊形）                                     |
| **背景色**   | `#FFD93D`（亮黄）                                     |
| **边框**     | `4rpx solid #D4380D`（红色描边）                      |
| **文字**     | "⬇️ 保存判决书"，`font-size: 32rpx`，`color: #D4380D` |

#### 6.7.2 交互行为

1. 点击按钮 → 调用 Canvas 绘制判决书图片（离屏 Canvas）
2. 使用 `wx.canvasToTempFilePath()` 导出图片
3. 调用 `wx.saveImageToPhotosAlbum()` 保存到相册
4. 首次使用需授权相册权限
5. 保存成功 → Toast "判决书已保存到相册"
6. 保存失败 → Toast "保存失败，请重试"

**实现位置**：

- WXML: `verdict__save-btn`
- TS: `onSaveVerdict()` 方法
- 工具: `miniprogram/utils/verdict-canvas.ts`

---

### 6.8 区域8: 赛后互动按钮（可选区域）

#### 6.8.1 按钮类型判定

```typescript
if (currentUserId === winnerId) {
    // 显示赢家按钮: 执行惩戒
    showButton('execute_punishment');
} else if (currentUserId === loserId) {
    // 显示输家按钮: 跪地求饶
    showButton('beg_for_mercy');
} else {
    // 平局: 共同退堂
    showButton('leave_together');
}
```

#### 6.8.2 赢家按钮：执行惩戒

| 元素       | 样式                                        |
| ---------- | ------------------------------------------- |
| **文案**   | "⚡ 执行惩戒 (5/5)"                         |
| **背景色** | `#FFD93D`（金色）                           |
| **文字色** | `#D4380D`                                   |
| **状态**   | 每次点击 3s 冷却 + 次数递减，用完后永久置灰 |

**点击效果（发送到输家端）**:

- 输家屏幕中央弹出巨大"卒"字（红色印章风格）
- `wx.vibrateLong()` 强震动
- 持续 2s 后消失

#### 6.8.3 输家按钮：跪地求饶

| 元素       | 样式                |
| ---------- | ------------------- |
| **文案**   | "🥺 跪地求饶 (5/5)" |
| **背景色** | `#E8E8E8`（灰色）   |
| **文字色** | `#666`              |
| **状态**   | 同赢家冷却机制      |

**点击效果（发送到赢家端）**:

- 赢家屏幕显示 🥺 emoji 从下方飘入 + "求求了~" 文字
- `wx.vibrateShort()` 轻震动
- 持续 2s 后消失

#### 6.8.4 平局按钮：共同退堂

| 元素       | 样式              |
| ---------- | ----------------- |
| **文案**   | "🤝 共同退堂"     |
| **背景色** | `#4D96FF`（蓝色） |
| **文字色** | `#FFFFFF`         |

**行为**:

- 单方点击 → 文字变为 "等待对方一起退堂..."
- 双方都点击 → `wx.redirectTo` 跳转至首页

**实现位置**：

- WXML: `verdict__post-game`
- TS: `onPostGameAction()` / `handlePostGameEffect()` 方法
- 组件: `miniprogram/components/post-game-effect/`

---

## 7. 密折弹窗设计

### 7.1 弹窗结构

从底部滑入的**半屏弹窗**（高度 `65vh`），封装为独立组件 `secret-modal`。

```
┌─────────────────────────────────────┐
│         （页面内容，被遮罩覆盖）        │
├═════════════════════════════════════┤
│  ── 拖拽指示条 ──                    │
│    📜 密折·仅你可见                   │
│  ┌─────────────────────────────┐    │
│  │  本次封号:  嘴硬大魔王 🏆    │    │
│  │  (嘴硬程度 90/100)           │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  🎯 锦囊妙计                │    │
│  │  下次吵架前先深呼吸三次...   │    │
│  └─────────────────────────────┘    │
│      [ 关闭密折 ]                    │
└─────────────────────────────────────┘
```

### 7.2 样式详情

| 元素           | 样式                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| **遮罩层**     | `background: rgba(0, 0, 0, 0.5)`，点击可关闭弹窗                                |
| **弹窗容器**   | `background: #FFFEF7`，`border-radius: 32rpx 32rpx 0 0`，`padding: 40rpx 32rpx` |
| **弹窗高度**   | `65vh`                                                                          |
| **拖拽指示条** | `width: 80rpx`，`height: 8rpx`，`background: #CCC`，`border-radius: 4rpx`，居中 |
| **标题**       | "📜 密折·仅你可见"，`font-size: 36rpx`，`color: #D4380D`，`font-weight: bold`   |
| **封号卡片**   | `background: #FFF8E1`，`border: 2rpx solid #FFD93D`，`border-radius: 12rpx`     |
| **封号标题**   | `font-size: 40rpx`，`font-weight: bold`，`color: #D4380D`                       |
| **封号维度**   | `font-size: 24rpx`，`color: #999`                                               |
| **锦囊卡片**   | `background: #F0FFF4`，`border: 2rpx solid #6BCF7F`，`border-radius: 12rpx`     |
| **锦囊文字**   | `font-size: 28rpx`，`color: #333`，`line-height: 1.8`                           |
| **关闭按钮**   | 文字按钮 "关闭密折"，`font-size: 28rpx`，`color: #999`，居中                    |

### 7.3 数据映射

| UI 元素  | 数据字段                                            |
| -------- | --------------------------------------------------- |
| 封号标题 | `secretReports[currentRole].title`                  |
| 封号维度 | 取 `battleStats[currentRole]` 中最高分维度名 + 分值 |
| 锦囊文字 | `secretReports[currentRole].advice`                 |

### 7.4 弹窗动画

| 动画     | 实现方式               | 参数                                                  |
| -------- | ---------------------- | ----------------------------------------------------- |
| 弹窗滑入 | `wx.createAnimation()` | `translateY(100% → 0)`，`duration: 300ms`，`ease-out` |
| 弹窗滑出 | `wx.createAnimation()` | `translateY(0 → 100%)`，`duration: 250ms`，`ease-in`  |
| 遮罩淡入 | `wx.createAnimation()` | `opacity(0 → 1)`，`duration: 250ms`                   |

**实现位置**：

- 组件: `miniprogram/components/secret-modal/`

---

## 8. 保存判决书图片生成

### 8.1 图片规格

| 参数            | 值                        |
| --------------- | ------------------------- |
| **宽度**        | `750px`                   |
| **高度**        | 动态计算（内容撑开）      |
| **格式**        | PNG                       |
| **Canvas 类型** | 离屏 Canvas 或隐藏 Canvas |

### 8.2 图片内容

生成的图片包含区域 1-5 的所有内容（不含按钮），底部增加：

- 小程序码（用于扫码分享）
- 文字 "扫码开始你的审判"
- 生成时间戳

### 8.3 Canvas 绘制顺序

1. 绘制背景（米白 + 红色边框）
2. 绘制标题区（红色背景 + 文字）
3. 绘制责任分布区（卡片 + 数字）
4. 绘制雷达图（Canvas → 图片 → 贴入主 Canvas）
5. 绘制大老爷赠言区
6. 绘制惩罚令牌区
7. 绘制底部信息（小程序码 + 时间）
8. 导出图片

**实现位置**：

- 工具: `miniprogram/utils/verdict-canvas.ts`

---

## 9. WebSocket 消息定义

### 9.1 新增消息类型

在 `EWSMessageType` 枚举中新增：

```typescript
enum EWSMessageType {
    // ... 现有类型 ...

    /** 判决结果推送（Server → Client） */
    VERDICT_RESULT = 'VERDICT_RESULT',

    /** 赛后互动-执行惩戒（Client → Server） */
    POST_GAME_ACTION = 'POST_GAME_ACTION',

    /** 赛后互动-效果推送（Server → Client） */
    POST_GAME_EFFECT = 'POST_GAME_EFFECT',

    /** 共同退堂确认（Client → Server） */
    LEAVE_TOGETHER = 'LEAVE_TOGETHER',

    /** 共同退堂完成（Server → Client） */
    LEAVE_TOGETHER_ACK = 'LEAVE_TOGETHER_ACK',
}
```

### 9.2 消息 Payload 定义

#### VERDICT_RESULT (Server → Client)

```typescript
interface IVerdictResultPayload {
    roomId: string;
    result: IVerdictResult; // 完整判决数据
}
```

#### POST_GAME_ACTION (Client → Server)

```typescript
interface IPostGameActionPayload {
    roomId: string;
    action: 'execute_punishment' | 'beg_for_mercy';
    remainingCount: number;
}
```

#### POST_GAME_EFFECT (Server → Client)

```typescript
interface IPostGameEffectPayload {
    roomId: string;
    effect: 'stamp_death' | 'beg_emoji';
    fromUserId: string;
}
```

#### LEAVE_TOGETHER (Client → Server)

```typescript
interface ILeaveTogetherPayload {
    roomId: string;
}
```

#### LEAVE_TOGETHER_ACK (Server → Client)

```typescript
interface ILeaveTogetherAckPayload {
    roomId: string;
    allReady: boolean; // true = 双方都确认，可以退出
}
```

---

## 10. 状态管理

### 10.1 页面 Data 结构

```typescript
interface IVerdictPageData {
    /** 是否加载中 */
    loading: boolean;

    /** 判决结果数据 */
    verdict: IVerdictResult | null;

    /** 当前用户角色 */
    currentRole: 'host' | 'guest';

    /** 当前用户是否为赢家 */
    isWinner: boolean;

    /** 是否平局 */
    isDraw: boolean;

    /** 密折弹窗是否显示 */
    showSecretModal: boolean;

    /** 赛后互动剩余次数 */
    actionRemainingCount: number;

    /** 赛后互动按钮冷却中 */
    actionCooldown: boolean;

    /** 共同退堂等待状态 */
    leaveWaiting: boolean;

    /** 入场动画数据 */
    headerAnimation: WechatMiniprogram.AnimationExportResult;
    card1Animation: WechatMiniprogram.AnimationExportResult;
    card2Animation: WechatMiniprogram.AnimationExportResult;
    card3Animation: WechatMiniprogram.AnimationExportResult;
    card4Animation: WechatMiniprogram.AnimationExportResult;
    card5Animation: WechatMiniprogram.AnimationExportResult;

    /** 责任百分比动画当前值 */
    hostPercentDisplay: number;
    guestPercentDisplay: number;

    /** 赠言打字机当前文字 */
    summaryDisplayText: string;

    /** 赛后效果动画 */
    showStampEffect: boolean;
    showBegEffect: boolean;

    /** 保存判决书状态 */
    saving: boolean;
}
```

### 10.2 生命周期

```typescript
Page({
    onLoad(options: { roomId: string }): void {
        // 1. 从 options 或 globalData 获取 roomId 和 currentRole
        // 2. 获取判决数据（从页面参数传入或 HTTP 请求）
        // 3. 注册 WebSocket 消息监听（赛后互动）
        // 4. 启动入场动画序列
    },

    onReady(): void {
        // 1. 初始化 Canvas（雷达图）
        // 2. 绘制雷达图
    },

    onUnload(): void {
        // 1. 清理动画 timer
        // 2. 取消 WebSocket 监听
    },
});
```

---

## 11. 动画时序总表

页面加载后，各区域按顺序依次进行入场动画：

| 时间轴 (ms) | 区域       | 动画描述                  |
| ----------- | ---------- | ------------------------- |
| 0-600       | 标题区     | 鸭子弹入 + 标题淡入       |
| 600-1000    | 责任分布   | 三张卡片依次弹入          |
| 1000-1500   | 责任分布   | 百分比数字计数动画        |
| 1200-2000   | 六维战力图 | 雷达图从中心展开          |
| 2000-2800   | 大老爷赠言 | 卡片弹入 + 文字打字机效果 |
| 2800-3100   | 惩罚令牌   | 盖章效果 + 震动           |
| 3100-3500   | 底部按钮   | 按钮依次淡入              |

**总动画时长**: 约 `3.5s`

**重要**: 所有动画必须使用 `wx.createAnimation()` 实现，**CSS animation/transition 严格禁止**。

---

## 12. 异常处理

### 12.1 数据加载失败

| 场景                     | 处理                                 |
| ------------------------ | ------------------------------------ |
| 判决数据获取失败（HTTP） | 显示错误提示页，提供"重新加载"按钮   |
| 判决数据格式异常         | 使用默认搞笑判决兜底                 |
| WebSocket 断连           | 赛后互动按钮置灰，提示"网络连接中断" |

### 12.2 Canvas 绘制失败

| 场景            | 处理                       |
| --------------- | -------------------------- |
| Canvas 创建失败 | 雷达图区域显示静态图片替代 |
| 保存图片失败    | Toast "保存失败，请重试"   |
| 相册权限被拒绝  | 引导用户到设置页开启权限   |

### 12.3 赛后互动异常

| 场景             | 处理                                 |
| ---------------- | ------------------------------------ |
| 对方已退出房间   | 隐藏互动按钮，显示"对方已离开"       |
| 消息发送失败     | Toast "发送失败"，不消耗次数         |
| 共同退堂超时 30s | 提示"对方未响应"，显示"直接退出"按钮 |

---

## 13. 性能优化

| 优化项         | 方案                                                          |
| -------------- | ------------------------------------------------------------- |
| **首屏渲染**   | 标题区先渲染，其余区域懒加载（延时加载或监听滚动位置）        |
| **雷达图**     | Canvas 只绘制一次，结果缓存为图片                             |
| **判决书图片** | 点击保存时才生成（不预生成）                                  |
| **动画流畅**   | `wx.createAnimation()` + `setData` 分批更新，避免大量 setData |
| **图片资源**   | 鸭子图标等静态资源使用本地文件（已在子包中）                  |
| **WebSocket**  | 复用 `wsManager` 单例连接                                     |

---

## 14. 埋点建议

| 事件名                 | 说明           | 触发时机         |
| ---------------------- | -------------- | ---------------- |
| `verdict_page_load`    | 页面加载完成   | `onLoad`         |
| `verdict_save_click`   | 点击保存判决书 | 点击保存按钮     |
| `verdict_save_success` | 保存成功       | 保存到相册成功   |
| `verdict_save_fail`    | 保存失败       | 保存失败回调     |
| `secret_modal_open`    | 打开密折弹窗   | 点击密折按钮     |
| `post_game_action`     | 赛后互动点击   | 点击赛后互动按钮 |
| `leave_together_click` | 点击共同退堂   | 点击退堂按钮     |

---

## 15. 验收标准

### P0（必须通过）

- [ ] 判决结果数据完整展示（责任分布、战力图、赠言、惩罚）
- [ ] 责任百分比之和 = 100%
- [ ] 雷达图六个维度数据正确渲染，双方颜色区分
- [ ] 密折弹窗仅显示当前用户的个人数据
- [ ] 保存判决书功能正常（生成图片 + 保存到相册）
- [ ] 赛后互动按钮根据赢/输/平局正确显示
- [ ] 互动效果实时同步到对方设备

### P1（体验优化）

- [ ] 所有入场动画流畅，无卡顿
- [ ] 百分比数字有计数动画效果
- [ ] 赠言有打字机效果
- [ ] 惩罚令牌有盖章动画 + 震动
- [ ] 按钮冷却机制正常（3s 冷却 + 次数递减）
- [ ] 页面适配不同机型（iPhone SE ~ iPhone 15 Pro Max）

### P2（锦上添花）

- [ ] 雷达图展开动画流畅
- [ ] 判决书图片排版美观，适合社交分享
- [ ] 页面滚动流畅，无白屏

---

## 16. 实现状态

### 当前状态（2026-02-13）

- ⏳ **待开发** - 页面基础布局与标题区
- ⏳ **待开发** - 责任分布区域（含计数动画）
- ⏳ **待开发** - 雷达图组件（Canvas 2D）
- ⏳ **待开发** - 大老爷赠言（打字机效果）
- ⏳ **待开发** - 惩罚令牌（盖章动画）
- ⏳ **待开发** - 密折弹窗组件
- ⏳ **待开发** - 保存判决书功能（离屏 Canvas 生成图片）
- ⏳ **待开发** - 赛后互动功能（WebSocket 双向通信）

### 后续规划

1. ⏳ **第一阶段**: 页面基础布局与标题区
2. ⏳ **第二阶段**: 责任分布区域（三列布局 + 计数动画）
3. ⏳ **第三阶段**: 雷达图组件（Canvas 2D 绘制）
4. ⏳ **第四阶段**: 大老爷赠言 + 惩罚令牌（打字机 + 盖章效果）
5. ⏳ **第五阶段**: 密折弹窗组件
6. ⏳ **第六阶段**: 保存判决书图片功能
7. ⏳ **第七阶段**: 赛后互动（WebSocket 消息 + 效果组件）
8. ⏳ **第八阶段**: 入场动画串联 + 性能优化

---

## 17. 前端文件结构

### 17.1 新增 / 修改文件

```
miniprogram/
├── packageB/
│   └── pages/
│       └── verdict/                    # 新增页面
│           ├── verdict.ts              # 页面逻辑
│           ├── verdict.wxml            # 页面模板
│           ├── verdict.wxss            # 页面样式
│           └── verdict.json            # 页面配置
├── components/
│   ├── radar-chart/                    # 新增组件: 雷达图
│   │   ├── index.ts
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── secret-modal/                   # 新增组件: 密折弹窗
│   │   ├── index.ts
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   └── post-game-effect/              # 新增组件: 赛后互动效果
│       ├── index.ts
│       ├── index.wxml
│       ├── index.wxss
│       └── index.json
├── services/
│   ├── verdict-service.ts              # 新增: 判决数据服务
│   └── post-game-service.ts            # 新增: 赛后互动服务
├── types/
│   ├── verdict.ts                      # 新增: 判决相关类型定义
│   └── websocket-common.ts             # 修改: 新增消息类型
└── utils/
    └── verdict-canvas.ts               # 新增: Canvas 绘制工具
```

### 17.2 页面配置 (verdict.json)

```json
{
    "usingComponents": {
        "avatar": "../../../components/avatar/index",
        "styled-button": "../../../components/styled-button/index",
        "radar-chart": "../../../components/radar-chart/index",
        "secret-modal": "../../../components/secret-modal/index",
        "post-game-effect": "../../../components/post-game-effect/index"
    },
    "navigationBarTitleText": "判决书",
    "navigationBarBackgroundColor": "#D4380D",
    "navigationBarTextStyle": "white",
    "disableScroll": false
}
```

### 17.3 app.json subpackage 配置更新

```json
{
    "subpackages": [
        {
            "root": "packageB",
            "pages": [
                "pages/chat-room/chat-room",
                "pages/verdict-waiting/verdict-waiting",
                "pages/verdict/verdict"
            ]
        }
    ]
}
```

---

## 18. 相关文件一览

- **页面实现**:
    - 结构: `miniprogram/packageB/pages/verdict/verdict.wxml`
    - 样式: `miniprogram/packageB/pages/verdict/verdict.wxss`
    - 逻辑: `miniprogram/packageB/pages/verdict/verdict.ts`
    - 配置: `miniprogram/packageB/pages/verdict/verdict.json`
- **新增组件**:
    - 雷达图: `miniprogram/components/radar-chart/`
    - 密折弹窗: `miniprogram/components/secret-modal/`
    - 赛后互动效果: `miniprogram/components/post-game-effect/`
- **服务层**:
    - WebSocket 管理: `miniprogram/services/websocket-manager.ts`
    - 判决数据服务: `miniprogram/services/verdict-service.ts`（新增）
    - 赛后互动服务: `miniprogram/services/post-game-service.ts`（新增）
- **类型定义**:
    - 判决类型: `miniprogram/types/verdict.ts`（新增）
    - WebSocket 通用: `miniprogram/types/websocket-common.ts`（修改）
- **工具函数**:
    - Canvas 绘制: `miniprogram/utils/verdict-canvas.ts`（新增）
- **产品文档**:
    - 原始 PRD: `Verdict_Page_PRD.md`
    - 本实现文档: `docs/miniprogram/verdict.md`
    - 服务层说明: `docs/miniprogram/services.md`

---

## 19. 设计资源需求

| 资源               | 类型 | 规格            | 说明                         |
| ------------------ | ---- | --------------- | ---------------------------- |
| 清汤大老爷头像     | PNG  | `120×120px` @2x | 标题区 + 赠言区使用          |
| 玩家默认头像（男） | PNG  | `100×100px` @2x | 蓝色风格                     |
| 玩家默认头像（女） | PNG  | `100×100px` @2x | 粉色风格                     |
| "卒"字印章         | PNG  | `300×300px` @2x | 赛后互动盖章效果，透明背景   |
| 🥺求饶 emoji       | PNG  | `200×200px` @2x | 赛后互动求饶效果             |
| 页面装饰纹理       | PNG  | 可平铺          | 古风卷轴质感背景纹理（可选） |

---

## 20. 设计原则总结

1. **爆笑感优先** - 以搞笑夸张的波普风视觉传达判决结果，激发分享欲
2. **信息层级清晰** - 从上到下：总览 → 责任 → 对比 → 点评 → 惩罚 → 私密反馈
3. **动画即叙事** - 入场动画 3.5s 依次展开，如同判决书逐步宣读
4. **私密与公开分离** - 密折仅用户自己可见，通过弹窗隔离
5. **强反馈** - 盖章震动、惩戒效果、求饶飘字等增强互动感
6. **性能优先** - Canvas 只绘制一次、图片按需生成、setData 分批更新
