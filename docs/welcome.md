## 欢迎界面（Welcome Page / 首页）文档

基于《欢迎界面（首页）功能 PRD v1.0》梳理的实现文档，对应页面代码位于：

- `miniprogram/pages/welcome/index.json`
- `miniprogram/pages/welcome/index.wxml`
- `miniprogram/pages/welcome/index.wxss`
- `miniprogram/pages/welcome/index.ts`

本文档用于在产品、设计、前端之间对齐「欢迎页」的目标、布局和交互细节。

---

### 1. 功能概述

- **功能定位**：用户进入小程序后的第一个页面，负责建立整体第一印象，并作为进入玩法的主入口。
- **核心职责**：
    - 建立荒诞搞笑的产品调性（清汤大老爷形象）
    - 引导「开始审判」和「通过房间号加入」两条主流程
    - 提供设置、规则、反馈等辅助入口
- **核心目标**：
    - 3 秒内吸引注意力（强视觉 + 动画）
    - 5 秒内理解产品是「情侣吵架解压工具」
    - 10 秒内完成点击行为进入后续流程

---

### 2. 页面结构与布局

#### 2.1 屏幕分区

PRD 定义的 A/B/C/D 四大区域，在当前实现中的对应关系：

- **区域 A：顶部留白 / 装饰区域**
    - 对应：已移除（当前实现中不再包含此区域）
    - 说明：页面采用更紧凑的布局，直接展示主视觉内容
- **区域 B：主视觉 + 角色区域**
    - 对应：`welcome-page__hero`
    - 内部包含（按入场顺序）：
        - **阶段 1**：情绪标题 `welcome-page__title` / `welcome-page__title-text`
            - 文案："判了么"，白字 + 黑色描边 + 右下投影
            - 入场动画：旋转 + 弹性缩放
        - **阶段 2**：主角头像区 `welcome-page__avatar-wrapper` / `welcome-page__avatar-container` / `welcome-page__avatar-image`
            - 清汤大老爷头像（在线图片）
            - 入场动画：缩放 + 淡入
            - 持续动画：呼吸效果（入场完成后启动）
        - **阶段 3**：副标题与 Slogan `welcome-page__tagline` 及其子元素
            - 主 tagline 文案：`清汤大老爷在线断案`（亮黄色 + 立体阴影）
            - 次 tagline 文案：`将争吵转化为游戏 · 在爆笑中和好如初`（白色 + 柔和阴影）
            - 入场动画：上滑 + 淡入
    - 功能：承载核心视觉与情绪表达，是用户视线首先聚焦的区域。
- **区域 C：主操作按钮区域**
    - 对应：`welcome-page__actions`
    - 包含：
        - **阶段 4**：唯一主 CTA 按钮「我要申冤！」 → `handleStartJudge`（已实现导航到等待房间页）
        - 入场动画：弹性缩放入场
- **区域 D：底部功能区**
    - 对应：`welcome-page__footer`
    - 包含（**阶段 5**）三个文字入口（无图标）：
        - 「设置」 → `handleSettings`
        - 「规则」 → `handleRules`
        - 「反馈」 → `handleFeedback`
    - 入场动画：淡入

#### 2.2 视觉层级（z-index）

当前样式采用更简洁的层级划分：

- **Layer 1 - 背景层**
    - 整个 `welcome-page` 容器的线性渐变背景。
- **Layer 2 - 主视觉层**
    - `welcome-page__hero` 区域中的标题、头像、tagline。
- **Layer 3 - UI 交互层**
    - `welcome-page__actions`、`welcome-page__footer`，承载主按钮、次按钮和底部功能图标。
- **Layer 4 - 弹窗层（待实现）**
    - PRD 中定义的「输入房间号弹窗」「规则说明弹窗」目前尚未在 WXML 中实现，后续可通过 `wx.showModal` 或自定义弹窗组件实现。

#### 2.3 安全区域与适配

- 布局上通过 `min-height: 100vh` 和上下分区，预留顶部与底部空间，避免关键按钮贴边。
- 后续可在 `welcome-page__content` 上进一步根据刘海屏 / 底部横条机型进行优化（例如预留 `padding-top` / `padding-bottom`），以完全对齐 PRD 的安全区域规范。

---

### 3. 核心视觉元素

#### 3.1 背景与主视觉

- **背景渐变**：
    - 使用 135° 渐变，色彩从红 → 橙 → 黄过渡（`#ff3b30 → #ff7a00 → #ffc400`），对应当前实现的高饱和暖色背景。
- **情绪标题（判了么）**：
    - 白色大号字体，黑色描边 + 右下黑色投影，形成强烈 pop 风格视觉冲击，是整个页面的第一视觉锚点。
- **副标题与 Slogan**：
    - 副标题采用亮黄色文字 + 立体阴影，强调「清汤大老爷在线断案」的设定。
    - Slogan 采用白色文字 + 柔和阴影，补充「将争吵转化为游戏 · 在爆笑中和好如初」的产品价值主张。

#### 3.2 清汤大老爷（鸭子角色）

- **头像展示**：
    - 图片源：在线图片 URL（Unsplash），黄色鸭子卡通形象
    - 展示区域：`welcome-page__avatar-container` / `welcome-page__avatar-image`
    - 图片模式：`aspectFill`，充满 220rpx × 220rpx 的圆形容器，超出部分自动裁剪
    - 容器样式：白色背景、8rpx 黑色边框、圆形、带阴影
- **皇冠装饰**：
    - 位置：头像上方（`top: -45rpx`），居中显示
    - 样式：使用 emoji 图标 👑，字体大小 60rpx
    - 对应元素：`welcome-page__avatar-badge` / `welcome-page__badge-icon`
- **动画效果**：
    - 呼吸动画：使用 `wx.createAnimation` 实现，scale 在 1.0 到 1.3 之间循环（每 1.5 秒切换）
    - 动画绑定：通过 `animation="{{ avatarAnimation }}"` 绑定到 `welcome-page__avatar-wrapper`

#### 3.3 主 CTA 按钮

- **视觉设计**：
    - 背景：红色渐变（`linear-gradient(180deg, #ff3b30 0%, #e6392e 100%)`）
    - 描边：8rpx 黑色边框，底部加粗至 12rpx 营造厚度感
    - 阴影：底部 8rpx 黑色投影 + 12rpx 16rpx 模糊阴影，增强立体感
    - 圆角：24rpx（大圆角，非胶囊形）
    - 尺寸：宽度 100%，高度自适应（上下 padding 各 50rpx）
- **文字样式**：
    - 文案：「我要申冤！」
    - 颜色：白色（`#ffffff`）
    - 字号：40rpx
    - 字重：700（粗体）
    - 字间距：2rpx
- **交互反馈**：
    - 按压状态（`hover-class="welcome-page__btn--cta-pressed"`）：
        - `scale(0.96)` 缩小
        - `translateY(6rpx)` 下移
        - 阴影变浅（模拟被按下效果）
    - 过渡动画：`transition` 0.1s ease-out

---

### 4. 动效与交互

#### 4.1 动画规范

- **实现原则**（与 PRD 对齐）：
    - 使用 `transform` 和 opacity，避免频繁修改 `left/top`。
    - 所有补间动画须通过 `wx.createAnimation` 实现（不使用 CSS 动画）。
    - 页面隐藏时（`onHide` / `onUnload`）应暂停或销毁动画，避免性能浪费。
    - **入场动画序列**（页面首次加载时播放）：
    - **实现方式**：采用"导演式"分阶段入场，通过 `playEntranceAnimation()` 统一调度
    - **时序配置**：使用 `TIMING` 常量统一管理各阶段延迟和时长
        - 总时长：约 2 秒（1600ms 底部导航入场 + 400ms 动画时长）
        - 各阶段延迟：标题 100ms → 头像 400ms → tagline 900ms → CTA 1300ms → 底部 1600ms
        - 呼吸动画启动：1200ms（头像入场完成后）
    - **阶段 1 - 主标题入场**（延迟 100ms，时长 1000ms）：
        - 效果：从 `scale(0) + rotate(-180deg) + opacity(0)` 弹性过渡到正常状态
        - 实现：先放大到 1.1 再回弹到 1.0，形成弹性效果
        - 绑定：`animation="{{ titleAnimation }}"` 到 `welcome-page__title`
    - **阶段 2 - 头像入场**（延迟 400ms，时长 600ms）：
        - 效果：从 `scale(0.6) + opacity(0)` 平滑过渡到正常
        - 实现：缩放 + 淡入，入场完成后标记 `avatarEntranceComplete: true`
        - 绑定：`animation="{{ avatarAnimation }}"` 到 `welcome-page__avatar-wrapper`
    - **阶段 3 - 副标题 + Slogan 入场**（延迟 900ms，时长 500ms）：
        - 效果：从下方滑入（`translateY`）+ 淡入（`opacity`）
        - 绑定：`animation="{{ taglineAnimation }}"` 到 `welcome-page__tagline`
    - **阶段 4 - CTA 按钮入场**（延迟 1300ms，时长 500ms）：
        - 效果：弹性缩放入场，先放大到 1.08 再回弹到 1.0，营造"落地感"
        - 绑定：`animation="{{ ctaAnimation }}"` 到 `welcome-page__actions`
    - **阶段 5 - 底部导航入场**（延迟 1600ms，时长 400ms）：
        - 效果：简单淡入（`opacity`）
        - 绑定：`animation="{{ footerAnimation }}"` 到 `welcome-page__footer`
    - **初始状态控制**：
        - 通过 `isEntranceReady` 标记控制元素初始隐藏状态（`--initial` 类）
        - 入场动画只播放一次（`hasPlayedEntrance` 标记）
- **持续动画**：
    - **头像呼吸动画**：
        - 启动时机：入场动画完成后（延迟 1200ms）
        - 实现位置：`index.ts` 中的 `startBreathingAnimation()` / `animateBreathing()`
        - 效果：头像在 scale 1.0 和 1.3 之间循环缩放，模拟呼吸效果
        - 周期：每 1.5 秒切换一次，完整周期 3 秒
        - 动画时长：每次缩放 1500ms，缓动函数 `ease-in-out`
        - 生命周期管理：页面显示时恢复，隐藏/卸载时停止

#### 4.2 交互入口与事件

`index.ts` 中定义的交互处理函数：

- **我要申冤！**：`handleStartJudge` ✅ **已实现**
    - 当前行为：延迟 250ms 后导航到等待房间页面（`/pages/waiting-room/index`）
    - 按钮样式：红色渐变背景、粗黑描边（8rpx，底部 12rpx）、底部厚度感阴影、大圆角（24rpx）
    - 按压反馈：使用 `hover-class="welcome-page__btn--cta-pressed"`，按下时 scale(0.96) + translateY(6rpx) + 阴影变浅
    - 文字样式：白色、40rpx、字重 700、上下 padding 50rpx
- **设置**：`handleSettings` ⏳ **待实现**
    - 期望行为：进入设置页（音效开关、震动开关等）。
- **规则**：`handleRules` ⏳ **待实现**
    - 期望行为：展示玩法 / 审判规则说明，可采用弹窗或独立页面。
- **反馈**：`handleFeedback` ⏳ **待实现**
    - 期望行为：跳转到反馈页或打开客服 / 问卷链接。

---

### 5. 状态与后续规划

#### 5.1 当前实现状态（2026-01-14）

- ✅ **已完成**：
    - 欢迎页面基础结构搭建（四大区域划分）
    - 135° 渐变背景（红→橙→黄）
    - 情绪标题「判了么」：96rpx 白色字体 + 黑色描边 + 右下黑色投影
    - 副标题与 Slogan：亮黄色主 tagline + 白色次 tagline
    - 主角头像展示：
        - 220rpx × 220rpx 圆形头像容器
        - 在线图片（Unsplash），aspectFill 模式充满容器
        - 头像上方皇冠装饰（👑 emoji，位置 -45rpx）
        - 头像呼吸动画（scale 1.0 ↔ 1.3，周期 3 秒）
    - **完整入场动画序列**：
        - 5 个阶段的分阶段入场（标题、头像、tagline、CTA、底部导航）
        - 使用 `wx.createAnimation` 实现，时序统一管理
        - 入场动画只播放一次，后续页面显示时恢复呼吸动画
    - 主 CTA 按钮「我要申冤！」：
        - 红色渐变背景 + 粗黑描边 + 底部厚度感
        - 按压反馈效果（hover-class）
        - 弹性缩放入场动画
        - 已实现导航到等待房间页面
    - 底部功能区：三个文字入口（设置、规则、反馈），带淡入入场动画
- ⏳ **待实现 / 待完善**：
    - 设置、规则、反馈页面的具体实现
    - WebSocket 相关的后续流程联动（与房间创建 / 加入流程串联）
    - 其他装饰元素的动画（如云朵、几何图形等）

#### 5.2 与 PRD 的对齐建议

- 设计与开发在联调时，可以本文件为对照：
    - 若 UI 细节与 PRD 更新，建议先更新本 `docs/welcome.md`，再同步到 `index.wxml` / `index.wxss`。
    - 新增交互或动画时，优先在「4. 动效与交互」中补充描述，确保后续维护人员能快速理解。

---

### 6. 相关文件一览

- 页面实现：
    - 结构：`miniprogram/pages/welcome/index.wxml`
    - 样式：`miniprogram/pages/welcome/index.wxss`
    - 逻辑：`miniprogram/pages/welcome/index.ts`
    - 配置：`miniprogram/pages/welcome/index.json`
- 产品文档：
    - 原始 PRD：`c:\Users\Shijia Huang\Downloads\欢迎界面_PRD_v1.0.md`
    - 本实现文档：`docs/welcome.md`
