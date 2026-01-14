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
- **区域 B：主角色动画区域**
    - 对应：`welcome-page__hero` + `welcome-page__character`（鸭子形象图片）
    - 功能：核心视觉焦点，承载清汤大老爷形象。
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

当前样式中已按照 PRD 要求拆出多层视觉层级：

- **Layer 1 - 背景层**
    - `welcome-page__background`
    - 渐变背景实现波普风高饱和色彩（红 / 黄 / 蓝 / 绿），对应 PRD 中的背景渐变方案。
- **Layer 2 - 动画装饰层**
    - `welcome-page__decorations` + `welcome-page__cloud*`、`welcome-page__shape*`
    - 包含云朵、圆形、星形、三角形、环、菱形等几何图形，用于增强动感和趣味。
- **Layer 3 - 主角色层**
    - `welcome-page__hero` 内部的 `welcome-page__character` 图片
    - 后续可在此区域增加 `wx.createAnimation` 实现角色待机动画。
- **Layer 4 - UI 交互层**
    - `welcome-page__actions`、`welcome-page__footer`
    - 承载点击按钮和底部功能图标。
- **Layer 5 - 弹窗层（待实现）**
    - PRD 中定义的「输入房间号弹窗」「规则说明弹窗」目前尚未在 WXML 中实现，后续可通过 `wx.showModal` 或自定义弹窗组件实现。

#### 2.3 安全区域与适配

- 布局上通过 `min-height: 100vh` 和上下分区，预留顶部与底部空间，避免关键按钮贴边。
- 后续可在 `welcome-page__content` 上进一步根据刘海屏 / 底部横条机型进行优化（例如预留 `padding-top` / `padding-bottom`），以完全对齐 PRD 的安全区域规范。

---

### 3. 核心视觉元素

#### 3.1 背景与装饰

- **背景渐变**：
    - 使用 135° 渐变，色彩从红 → 黄 → 蓝 → 绿过渡，对应 PRD 中的主背景渐变设定。
- **云朵元素**：
    - 通过多组 `welcome-page__cloud--1 ~ 4` 组成，位置分布在屏幕上方 / 中段 / 底部，满足「多处漂浮云朵」的氛围要求。
- **几何图形**：
    - 使用多个圆形、星形、三角形、环形、菱形等，颜色采用高饱和度并叠加透明度，贴合波普艺术风格。
- **"冤" 字水印（待实现）**：
    - PRD 中要求全屏散落的「冤」字低透明水印，目前代码中尚未添加，可后续通过 `text` 元素 + 低透明度样式补充。

#### 3.2 清汤大老爷（鸭子角色）

- 当前以静态图片 `duck.png` 承载主角形象：
    - 路径：`/images/duck.png`
    - 展示区域：`welcome-page__hero` 中居中显示。
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
