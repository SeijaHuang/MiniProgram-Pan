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
    - 对应：`welcome-page__header`
    - 功能：制造视觉呼吸空间，可用于轻量装饰元素或后续标语、副标题等。
- **区域 B：主视觉 + 角色区域**
    - 对应：`welcome-page__hero`
    - 内部包含：
        - 情绪标题：`welcome-page__title` / `welcome-page__title-text`（文案：“判了么”，白字 + 黑色描边 + 右下投影）
        - 主角头像区：`welcome-page__avatar-wrapper` / `welcome-page__avatar-container` / `welcome-page__avatar-image`（清汤大老爷头像）
        - 副标题与 Slogan：`welcome-page__tagline` 及其子元素
            - 主 tagline 文案：`清汤大老爷在线断案`（亮黄色 + 立体阴影）
            - 次 tagline 文案：`将争吵转化为游戏 · 在爆笑中和好如初`（白色 + 柔和阴影）
    - 功能：承载核心视觉与情绪表达，是用户视线首先聚焦的区域。
- **区域 C：主操作按钮区域**
    - 对应：`welcome-page__actions`
    - 包含：
        - 主按钮「开始审判」 → `handleStartJudge`
        - 次按钮「输入房间号」 → `handleInputRoom`
- **区域 D：底部功能区**
    - 对应：`welcome-page__footer`
    - 包含三个入口：
        - 「设置」 → `handleSettings`
        - 「规则」 → `handleRules`
        - 「反馈」 → `handleFeedback`

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

- 当前以静态图片 `duck.png` 承载主角头像：
    - 路径：`/images/duck.png`
    - 展示区域：`welcome-page__avatar-container` / `welcome-page__avatar-image`。
- 形象细节（参考 PRD）：
    - 呆萌鸭子 + 清朝官袍 + 官帽 + 惊堂木 + 卷轴 + 虎皮坐垫等元素可在视觉稿与素材阶段进一步完善。
- 尺寸与位置：
    - 当前实现保证角色居中且占据屏幕中部，后续可根据实际设备进一步精调宽高与位置，以接近 PRD 中的比例表。

---

### 4. 动效与交互

#### 4.1 动画规范

- **实现原则**（与 PRD 对齐）：
    - 使用 `transform` 和 opacity，避免频繁修改 `left/top`。
    - 所有补间动画须通过 `wx.createAnimation` 实现（不使用 CSS 动画）。
    - 页面隐藏时（`onHide` / `onUnload`）应暂停或销毁动画，避免性能浪费。
- **当前状态**：
    - `index.wxss` 已提供丰富装饰元素，但尚未接入 `wx.createAnimation` 动画逻辑。
    - 后续可以在 `index.ts` 中增加动画创建和导出数据字段，例如：
        - 云朵 / 几何图形的缓慢漂浮 / 旋转
        - 角色待机动画（轻微晃动、眨眼等）

#### 4.2 交互入口与事件

`index.ts` 中已预先定义交互处理函数（尚未实现具体逻辑）：

- **开始审判**：`handleStartJudge`
    - 期望行为：进入房主创建房间 / 匹配流程。
- **输入房间号**：`handleInputRoom`
    - 期望行为：弹出输入房间号弹窗或跳转到输入页。
- **设置**：`handleSettings`
    - 期望行为：进入设置页（音效开关、震动开关等）。
- **规则**：`handleRules`
    - 期望行为：展示玩法 / 审判规则说明，可采用弹窗或独立页面。
- **反馈**：`handleFeedback`
    - 期望行为：跳转到反馈页或打开客服 / 问卷链接。

---

### 5. 状态与后续规划

#### 5.1 当前实现状态（2026-01-14）

- 已完成：
    - 欢迎页面基础结构搭建（四大区域划分）
    - 波普风渐变背景 + 云朵 + 几何图形等装饰元素
    - 主角鸭子图片展示位
    - 主按钮 / 副按钮 / 底部三个功能入口布局与点击事件占位
- 待实现 / 待完善：
    - 所有角色与装饰动画接入 `wx.createAnimation`
    - 输入房间号、规则说明等弹窗 / 页面
    - WebSocket 相关的后续流程联动（与房间创建 / 加入流程串联）
    - 「冤」字水印背景元素

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
