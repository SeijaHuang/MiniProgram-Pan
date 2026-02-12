# 项目文档索引

本目录包含项目的详细实现文档，用于在产品、设计、前端之间对齐页面目标、布局和交互细节。

## 目录结构

```
docs/
├── README.md                   # 本索引文件
├── backend/                    # 后端文档
│   ├── api-specification.md    # API 规格说明
│   ├── data-models.md          # 数据模型
│   ├── architecture-visual.md  # 架构可视化
│   ├── product-requirements.md # 产品需求
│   └── features/               # 功能模块文档
│       ├── 01-room-creation.md          # 房间创建
│       ├── 02-join-room.md              # 加入房间
│       ├── 03-chat-messaging.md         # 聊天消息
│       ├── 04-connection-lifecycle.md   # 连接生命周期
│       ├── 05-error-handling.md         # 错误处理
│       ├── 06-drum-game.md              # 震天鼓游戏
│       └── 07-asr-real-time-speech.md   # ASR 实时语音识别
└── miniprogram/                # 小程序前端文档
    ├── welcome.md              # 欢迎页
    ├── waiting-room.md         # 等待页
    ├── drum-room.md            # 震天鼓抢麦页
    ├── chat-room.md            # 对簿公堂页
    ├── components.md           # 组件文档
    └── services.md             # 服务层说明
```

---

## 小程序前端文档（miniprogram/）

### 页面文档

#### 欢迎页（Welcome Page）

- **文件**: `miniprogram/welcome.md`
- **页面路径**: `/pages/welcome/index`
- **功能**: 用户进入小程序后的第一个页面，负责建立整体第一印象，并作为进入玩法的主入口
- **核心特性**:
    - 清汤大老爷角色展示
    - 完整的入场动画序列（5 个阶段）
    - 主 CTA 按钮「我要申冤！」
    - 底部功能区（设置、规则、反馈）
    - 使用 `styled-title` 和 `styled-button` 组件

#### 等待页（Waiting Room）

- **文件**: `miniprogram/waiting-room.md`
- **页面路径**: `/pages/waiting-room/index`
- **功能**: 房间创建和等待对方加入的页面，承担情绪缓冲、邀请引导、状态同步的作用
- **核心特性**:
    - 复用页面设计（创建者和被邀请者共用）
    - 状态管理（created_waiting、joining、ready、invalid）
    - 分享功能（发起申冤按钮）
    - 加入房间功能（被邀请者）
    - WebSocket 实时状态同步
    - 双方就位后自动跳转至 Drum Room
    - 使用 `styled-title` 和 `styled-button` 组件

#### Drum Room（震天鼓抢麦）

- **文件**: `miniprogram/drum-room.md`
- **页面路径**: `/pages/drum-room/index`
- **功能**: 抢先发言权对抗模块，通过短时间、高频点击的方式决定谁先申冤
- **核心特性**:
    - 3秒准备倒计时（强制同步，不可跳过）
    - 10秒抢麦点击竞争
    - 震天鼓按钮（点击反馈：动画、震动、音效、飞字）
    - 双方进度条实时显示分数
    - 胜负判定（分数高者胜，平局房主胜）
    - 结果展示后自动跳转至 Chat Room
    - WebSocket 实时状态同步

#### Chat Room（对簿公堂）

- **文件**: `miniprogram/chat-room.md`
- **页面路径**: `/pages/chat-room/index`
- **功能**: 核心对簿与情绪释放页面，承担双方轮流语音申冤、表情互动与倒计时控制职责
- **核心特性**:
    - 顶部倒计时（唯一顶部信息，根据剩余时间变化颜色和动画）
    - 发言舞台区域（状态提示和语音反馈）
    - 麦克风按钮（可发言/录音中/禁用三种状态）
    - 表情互动系统（仅监听方可操作，弹幕/飞行物形式）
    - 状态流转管理（waiting → speaker_turn → listener_turn → completed）
    - WebSocket 实时状态同步

### 组件文档

- **文件**: `miniprogram/components.md`
- **功能**: 项目中所有自定义组件的详细说明文档
- **包含组件**:
    - **Styled Button** (`styled-button`) - 可复用的样式化按钮组件
        - 支持多种颜色主题（红、黄、蓝、灰）
        - 支持图标和文字
        - 光线扫过动画效果
        - 按压反馈效果
    - **Countdown** (`countdown`) - 全屏倒计时遮罩组件
        - 倒计时数字显示
        - 震动反馈
        - 完成回调
    - **Styled Title** (`styled-title`) - 可复用的样式化标题组件
        - 统一的大号粗体白色文字风格
        - 黑色描边和投影效果
        - 支持动画绑定和初始状态控制

### 服务文档

- **文件**: `miniprogram/services.md`
- **功能**: `miniprogram/services` 目录下的业务服务层说明
- **包含服务**:
    - **WebSocket Manager** (`websocket-manager.ts`) - WebSocket 连接与重连管理
    - **Room Service** (`room-service.ts`) - HTTP 创建房间
    - **Room WebSocket Service** (`room-websocket-service.ts`) - WebSocket 加入房间与 JOIN_ACK
    - **Chat Service** (`chat-service.ts`) - 文本消息发送与 CHAT_RECEIVE
    - **Drum Service** (`drum-service.ts`) - 抢麦点击与对抗结果消息

---

## 后端文档（backend/）

### 核心文档

#### API 规格说明

- **文件**: `backend/api-specification.md`
- **功能**: 完整的 HTTP 和 WebSocket API 规范
- **核心内容**:
    - HTTP REST API（房间创建）
    - WebSocket 实时通信协议
    - 消息类型和格式（JOIN_ROOM, CHAT_SEND, ASR_START 等）
    - 错误代码参考
    - 完整流程示例

#### 数据模型文档

- **文件**: `backend/data-models.md`
- **功能**: 后端数据模型定义
- **核心内容**:
    - 核心实体（IRoom, IUser, IMessage, IAsrSession）
    - 枚举类型（ERoomStatus, EMessageType, EAsrSessionStatus）
    - 数据传输对象（DTO）
    - WebSocket 消息类型
    - 数据存储和验证

#### 架构可视化

- **文件**: `backend/architecture-visual.md`
- **功能**: 后端整体架构设计和可视化
- **核心内容**:
    - 三层架构模式（Controller → Service → Repository）
    - 单例模式（RoomManager, ConnectionManager）
    - 处理器模式
    - 技术栈和依赖

#### 产品需求

- **文件**: `backend/product-requirements.md`
- **功能**: 后端产品需求文档
- **核心内容**:
    - 业务需求
    - 功能范围
    - 技术约束
    - 优先级划分

### 功能模块文档（features/）

#### 01. 房间创建

- **文件**: `backend/features/01-room-creation.md`
- **功能**: HTTP 创建房间接口
- **核心内容**:
    - POST /v1/rooms API
    - 房间代码生成逻辑
    - 请求/响应格式
    - 错误处理

#### 02. 加入房间

- **文件**: `backend/features/02-join-room.md`
- **功能**: WebSocket 加入房间流程
- **核心内容**:
    - JOIN_ROOM 消息处理
    - JOIN_ACK 广播机制
    - 房间状态转换
    - 用户验证

#### 03. 聊天消息

- **文件**: `backend/features/03-chat-messaging.md`
- **功能**: 实时聊天消息
- **核心内容**:
    - CHAT_SEND 消息处理
    - CHAT_RECEIVE 广播
    - 消息 ID 生成
    - 时间戳管理

#### 04. 连接生命周期

- **文件**: `backend/features/04-connection-lifecycle.md`
- **功能**: WebSocket 连接管理
- **核心内容**:
    - 连接建立和认证
    - 心跳机制
    - 断线重连
    - 资源清理

#### 05. 错误处理

- **文件**: `backend/features/05-error-handling.md`
- **功能**: 统一错误处理机制
- **核心内容**:
    - 错误代码体系
    - 错误响应格式
    - 异常场景处理
    - 日志记录

#### 06. 震天鼓游戏

- **文件**: `backend/features/06-drum-game.md`
- **功能**: 双人抢麦游戏
- **核心内容**:
    - DRUM_READY/START/TAP/FINISH/RESULT 消息
    - 游戏状态机
    - 计分逻辑
    - 时间同步

#### 07. ASR 实时语音识别

- **文件**: `backend/features/07-asr-real-time-speech.md`
- **功能**: 实时语音转文字
- **核心内容**:
    - ASR_START/AUDIO/STOP/TEXT 消息
    - 腾讯云 ASR 集成
    - 会话管理和幂等性
    - Partial/Final 文本处理
    - 音频分片传输

---

## 文档结构说明

每个页面文档包含以下章节：

1. **页面基本信息** - 路径、类型、进入/退出方式
2. **页面目标** - 核心目标和用户心理状态
3. **页面整体结构** - 布局和视觉层级
4. **状态设计** - 状态枚举和流转逻辑
5. **页面元素详细说明** - 每个 UI 元素的样式、行为、实现位置
6. **状态变化与跳转逻辑** - 不同角色视角的流程
7. **Loading & 反馈设计** - 加载状态和用户反馈
8. **异常处理** - 错误场景和处理方式
9. **WebSocket 集成** - 实时通信相关（如适用）
10. **埋点建议** - 数据统计事件
11. **验收标准** - P0/P1 级别的验收清单
12. **相关文件一览** - 代码文件索引

---

## 使用指南

### 对于产品经理

- 查看页面目标和用户心理状态，理解设计意图
- 参考验收标准，确保功能完整性
- 查看埋点建议，规划数据统计

### 对于设计师

- 查看页面结构和视觉元素说明，确保 UI 实现与设计稿一致
- 参考动画和交互细节，理解动效需求
- 查看状态设计，理解不同状态下的 UI 变化

### 对于开发者

- 查看实现位置标注，快速定位代码文件
- 参考状态管理和跳转逻辑，实现业务逻辑
- 查看异常处理，完善错误场景
- 参考 WebSocket 集成，实现实时通信

### 对于 AI 助手（Cursor / Claude）

- 查看完整的页面 PRD，理解业务需求
- 参考实现位置和代码结构，生成符合规范的代码
- 查看状态设计和异常处理，确保逻辑完整性

---

## 更新规范

1. **新增页面时**: 在 `docs/miniprogram/` 目录下创建对应的 `.md` 文件，并更新本索引
2. **新增组件时**: 在 `docs/miniprogram/components.md` 中添加组件说明，并更新本索引
3. **更新页面时**: 同步更新对应的文档文件，保持文档与代码一致
4. **更新组件时**: 同步更新 `docs/miniprogram/components.md` 中的组件说明
5. **更新后端时**: 在 `docs/backend/` 目录下更新对应文档
6. **重大变更时**: 在文档中标注变更日期和原因，便于追溯

---

## 相关资源

- [项目主 README](../README.md) - 项目概述和快速开始
- [前端 README](../miniprogram/README.md) - 小程序前端详细说明
- [后端 README](../backend/README.md) - 后端服务详细说明
- [开发规范](../CLAUDE.md) - Claude Code 开发指南
- [项目配置](../tsconfig.json) - TypeScript 配置
