# 申冤 - 双人实时互动微信小程序

一款双人实时互动微信小程序，用户创建/加入房间，通过击鼓游戏决定发言顺序，然后轮流语音申冤。

## 项目概述

**用户流程**: 欢迎页 → 等待房间 → 震天鼓抢麦 (10秒点击竞争) → 对簿公堂 (轮流语音) → 等待判决 (AI分析loading) → 判决书展示

## 技术栈

| 层级         | 技术                                        |
| ------------ | ------------------------------------------- |
| **前端**     | 微信小程序原生框架 (TypeScript, WXML, WXSS) |
| **后端**     | Node.js + Express + WebSocket (ws)          |
| **语音识别** | 腾讯云 ASR (客户端直连)                     |
| **AI 判决**  | OpenAI gpt-4o                               |
| **实时通信** | WebSocket                                   |
| **代码规范** | ESLint + Prettier + Husky                   |

## 项目结构

```
.
├── miniprogram/          # 小程序前端
│   ├── pages/            # 主包页面 (welcome)
│   ├── packageA/pages/   # 分包A (waiting-room, drum-room)
│   ├── packageB/pages/   # 分包B (chat-room, verdict-waiting, verdict)
│   ├── components/       # 组件 (styled-button, styled-title, countdown, avatar, radar-chart, secret-modal, post-game-effect)
│   ├── services/         # 业务服务 (WebSocket, Room, Drum, ASR, STS, Verdict, PostGame)
│   ├── models/           # 领域模型
│   ├── types/            # 类型定义
│   ├── constants/        # 常量配置
│   └── utils/            # 工具函数
│
├── backend/              # Node.js 后端
│   └── src/
│       ├── routes/       # HTTP 路由
│       ├── controllers/  # 控制器
│       ├── services/     # 业务逻辑 (core, websocket, handlers)
│       ├── models/       # 数据模型
│       └── types/        # 类型定义
│
└── docs/                 # 项目文档
    ├── miniprogram/      # 前端文档 (页面、组件、服务)
    └── backend/          # 后端文档 (API、WebSocket、架构)
```

## 快速开始

### 前置要求

- Node.js >= 14.0.0
- 微信开发者工具
- npm

### 安装

```bash
# 1. 克隆项目后，安装前端依赖
npm install

# 2. 安装后端依赖
cd backend && npm install
```

### 启动后端

```bash
cd backend
npm run dev     # 开发模式 (http://localhost:8080, ws://localhost:8080/ws)
```

### 启动前端

1. 打开微信开发者工具
2. 导入项目根目录
3. 编译运行

## 开发命令

### 前端 (根目录)

```bash
npm run lint       # ESLint 检查
npm run lint:fix   # 自动修复
npm run format     # Prettier 格式化
npm run prepare    # 初始化 Husky
```

### 后端 (backend/)

```bash
npm run dev        # 开发模式 (ts-node)
npm run build      # 编译 TypeScript
npm start          # 生产模式
npm run ws:test    # 测试 WebSocket
npm run lint       # ESLint 检查
```

## 核心功能

### 房间系统

- **HTTP**: `POST /v1/rooms` 创建房间，返回 6 位房间码
- **WebSocket**: `JOIN_ROOM` 加入房间
- **状态机**: WAITING (1人) → READY (2人) → CLOSED

### 击鼓游戏 (Drum Room)

- 房间就绪后自动启动
- 3 秒倒计时 + 10 秒点击竞争
- 服务器计时计分，防止作弊
- 胜负判定：分高者胜，平局房主胜

### 聊天系统 (Chat Room)

- 轮流语音申冤 (ASR 实时语音转文字)
- 表情互动系统
- 倒计时控制
- 发言轮次管理 (SPEECH_TURN_END → SPEECH_TURN_SWITCH → CHAT_COMPLETE)

### 等待判决 (Verdict Waiting)

- LLM 判决生成期间的等待页面
- WebSocket 监听判决结果 (VERDICT_RESULT / VERDICT_FAILED)
- 多组并行动画 + 随机加载文案轮播
- 90 秒超时处理 + 失败重试机制 (最多 3 次)

### 判决书 (Verdict)

- AI 判决结果可视化 (长滚动卡片)
- 责任分布 (双方百分比 + 第三方因素)
- 六维战力雷达图 (Canvas 2D)
- 大老爷赠言 (打字机效果) + 惩罚令牌 (盖章动画)
- 密折弹窗 (私密反馈)
- 赛后互动 (赢家惩戒 / 输家求饶 / 平局退堂)

## WebSocket 消息类型

| 类型                 | 方向 | 说明             |
| -------------------- | ---- | ---------------- |
| `JOIN_ROOM`          | C→S  | 加入房间         |
| `JOIN_ACK`           | S→C  | 加入确认（广播） |
| `CHAT_SEND`          | C→S  | 发送文本消息     |
| `CHAT_RECEIVE`       | S→C  | 接收消息（广播） |
| `EMOJI_SEND`         | C→S  | 发送表情         |
| `EMOJI_RECEIVE`      | S→C  | 接收表情（广播） |
| `ASR_TEXT_PUSH`      | C→S  | 推送识别文本     |
| `ASR_TEXT`           | S→C  | 广播识别文本     |
| `DRUM_READY`         | S→C  | 游戏就绪         |
| `DRUM_START`         | S→C  | 游戏开始         |
| `DRUM_TAP`           | 双向 | 点击事件         |
| `DRUM_FINISH`        | S→C  | 游戏结束         |
| `DRUM_RESULT`        | S→C  | 游戏结果         |
| `SPEECH_TURN_END`    | C→S  | 发言轮次结束     |
| `SPEECH_TURN_SWITCH` | S→C  | 切换发言轮次     |
| `CHAT_COMPLETE`      | S→C  | 双方发言完毕     |
| `VERDICT_RESULT`     | S→C  | 判决结果推送     |
| `VERDICT_FAILED`     | S→C  | 判决生成失败     |
| `VERDICT_RETRY`      | C→S  | 请求重试判决     |
| `POST_GAME_ACTION`   | C→S  | 赛后互动操作     |
| `POST_GAME_EFFECT`   | S→C  | 赛后互动特效     |
| `LEAVE_ROOM`         | C→S  | 离开房间         |
| `LEAVE_ROOM_ACK`     | S→C  | 离开房间确认     |
| `ERROR`              | S→C  | 错误消息         |

## 开发规范

### TypeScript

- 禁止使用 `any` 类型
- 所有变量、函数参数和返回值必须显式声明类型
- 接口前缀 `I` (如 `IUser`, `IRoom`)

### 动画

- 必须使用 `wx.createAnimation()` API
- 禁止使用 CSS animations/transitions

### 样式

- 使用 `rpx` 响应式单位
- BEM 命名规范
- 禁止使用 `!important`

## 文档

详细文档请查看 `docs/` 目录：

- [文档索引](docs/README.md)
- [前端文档](docs/miniprogram/)
- [后端文档](docs/backend/)
- [后端 README](backend/README.md)
- [前端 README](miniprogram/README.md)

## 许可证

ISC
