# Verdict Waiting（判决等待）页面文档

对应页面代码位于：

- `miniprogram/packageB/pages/verdict-waiting/index.json`
- `miniprogram/packageB/pages/verdict-waiting/index.wxml`
- `miniprogram/packageB/pages/verdict-waiting/index.wxss`
- `miniprogram/packageB/pages/verdict-waiting/index.ts`
- `miniprogram/packageB/pages/verdict-waiting/animations.ts`

---

## 1. 页面基本信息

| 项目     | 说明                                                                 |
| -------- | -------------------------------------------------------------------- |
| 页面名称 | Verdict Waiting（判决等待）                                          |
| 页面路径 | `/packageB/pages/verdict-waiting/index`                              |
| 页面类型 | 过渡加载页                                                           |
| 进入方式 | Chat Room 双方发言结束后（收到 `CHAT_COMPLETE`）自动跳转             |
| 退出方式 | 收到 `VERDICT_RESULT` 后 `redirectTo` 判决页；90s 超时后显示超时界面 |
| 设计风格 | 搞笑娱乐感，多层并行动画，掩盖 LLM 等待时间                          |
| 优先级   | P0（主流程核心页面）                                                 |

---

## 2. 页面目标（Why）

- 掩盖 LLM 生成判决的等待时间（通常 5-30 秒）
- 维持用户期待感和娱乐感，避免用户感知等待
- 通过滚动文案和多层动画制造"大老爷正在认真审阅"的沉浸感

---

## 3. 进入条件

- Chat Room 收到服务器 `CHAT_COMPLETE` 消息后，通过 `wx.navigateTo` 跳转
- 页面通过 URL 参数接收 `roomCode` 和 `roomId`
- 页面 `onLoad` 后立即开始监听 `VERDICT_RESULT` / `VERDICT_FAILED`

---

## 4. 动画系统

所有动画均使用 `wx.createAnimation()` 实现（见 `animations.ts`）。

### 4.1 并行动画列表

| 动画名                                   | 描述                                 |
| ---------------------------------------- | ------------------------------------ |
| `titleAnimation`                         | 标题文字呼吸发光（持续循环）         |
| `duckFloatAnimation`                     | 大老爷图标浮动（上下周期运动）       |
| `dogLeftAnimation` / `dogRightAnimation` | 两只狗从两侧向中间撞击               |
| `collisionAnimation`                     | 碰撞后中央特效闪烁                   |
| `shakeAnimation`                         | 碰撞时屏幕抖动（translateX 震动）    |
| `gearAnimation`                          | 齿轮持续旋转动画                     |
| `cardAnimation`                          | 文案卡片入场（translateY + opacity） |
| `textAnimations[]`                       | 每条加载文案的单独入场动画           |
| `particleAnimations[]`                   | 25 个粒子各自的上升漂浮动画          |

### 4.2 最小展示时间

- 即使 LLM 返回极快（< 5s），页面最少展示 `MIN_DISPLAY_MS`（默认 5000ms）
- 超时上限 `ANALYSIS_TIMEOUT_MS`（默认 90000ms = 90s）

---

## 5. 文案系统

- 文案池 `LOADING_TEXTS`：30 条搞笑加载文案，定义于 `constants/verdict-waiting.ts`
- 每次从池中随机抽取 `TEXT_POOL_SIZE` 条，按 `TEXT_INTERVAL_MS` 间隔轮播
- 同时展示最多 `MAX_VISIBLE_TEXTS` 条，每条有独立入场动画
- 省略号动画（`dots`）：每隔 `DOTS_INTERVAL_MS` 在 `...` / `..` / `.` 间循环

---

## 6. WebSocket 流程

```
页面 onLoad
  → verdictService.startListening()
  → 等待 VERDICT_RESULT 或 VERDICT_FAILED

收到 VERDICT_RESULT
  → verdictService 缓存结果
  → 等待最小展示时间（MIN_DISPLAY_MS）
  → showFinalText = true（展示"判决已出"文案）
  → FINAL_TEXT_DELAY_MS 后 wx.redirectTo(verdict)

收到 VERDICT_FAILED
  → showError = true, errorMessage, canRetry
  → 用户点击重试 → 发送 VERDICT_RETRY → 重新监听
  → canRetry = false 时显示"彻底失败"界面

超时（90s）
  → showTimeout = true
  → 提供返回首页按钮
```

### 6.1 消息类型

| 消息类型         | 方向            | 说明                              |
| ---------------- | --------------- | --------------------------------- |
| `VERDICT_RESULT` | Server → Client | 判决结果推送，含完整 verdict 数据 |
| `VERDICT_FAILED` | Server → Client | 判决生成失败，含 `canRetry` 标志  |
| `VERDICT_RETRY`  | Client → Server | 用户请求重试                      |

---

## 7. 页面 Data 结构

```typescript
interface IVerdictWaitingPageData {
    roomId: string;
    roomCode: string;

    // 文案
    visibleTexts: ILoadingText[]; // { id: number, text: string }[]
    dots: string; // '...' / '..' / '.'

    // 粒子
    particles: IParticle[]; // 25 个粒子配置

    // 状态
    isAnalyzing: boolean;
    showTimeout: boolean;
    showFinalText: boolean;
    showError: boolean;
    errorMessage: string;
    canRetry: boolean;

    // 动画（wx.createAnimation 导出）
    titleAnimation: AnimationExportResult | null;
    duckFloatAnimation: AnimationExportResult | null;
    dogLeftAnimation: AnimationExportResult | null;
    dogRightAnimation: AnimationExportResult | null;
    collisionAnimation: AnimationExportResult | null;
    shakeAnimation: AnimationExportResult | null;
    cardAnimation: AnimationExportResult | null;
    gearAnimation: AnimationExportResult | null;
    textAnimations: AnimationExportResult[];
    particleAnimations: AnimationExportResult[];
}
```

---

## 8. 常量配置

定义于 `miniprogram/constants/verdict-waiting.ts`：

| 常量名                | 说明                            |
| --------------------- | ------------------------------- |
| `LOADING_TEXTS`       | 加载文案数组（30 条）           |
| `TEXT_POOL_SIZE`      | 每轮随机抽取文案数              |
| `TEXT_INTERVAL_MS`    | 文案切换间隔（ms）              |
| `MAX_VISIBLE_TEXTS`   | 同时可见文案条数                |
| `ANALYSIS_TIMEOUT_MS` | 判决超时时间（默认 90000ms）    |
| `DOTS_INTERVAL_MS`    | 省略号切换间隔（ms）            |
| `FINAL_TEXT_DELAY_MS` | "判决已出"后跳转延迟（ms）      |
| `MIN_DISPLAY_MS`      | 页面最短展示时间（默认 5000ms） |

---

## 9. 实现状态（2026-03-15）

- ✅ **已完成** - 多层并行动画（标题、鸭子浮动、狗碰撞、粒子、齿轮）
- ✅ **已完成** - 文案轮播系统（随机池 + 逐条入场动画）
- ✅ **已完成** - WebSocket 监听（VERDICT_RESULT / VERDICT_FAILED）
- ✅ **已完成** - 重试机制（VERDICT_RETRY，最多 3 次）
- ✅ **已完成** - 最小展示时间 + 超时界面
- ✅ **已完成** - 错误状态展示

---

## 10. 相关文件

- **页面实现**: `miniprogram/packageB/pages/verdict-waiting/`
- **动画工厂**: `miniprogram/packageB/pages/verdict-waiting/animations.ts`
- **常量配置**: `miniprogram/constants/verdict-waiting.ts`
- **类型定义**: `miniprogram/types/verdict-waiting.ts`
- **服务层**: `miniprogram/services/verdict-service.ts`
- **下一页面**: `miniprogram/packageB/pages/verdict/`
