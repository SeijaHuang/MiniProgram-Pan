# 申冤小程序 - 前端

微信小程序原生框架开发的双人实时互动前端应用。

## 技术栈

- **框架**: 微信小程序原生框架
- **语言**: TypeScript
- **模板**: WXML
- **样式**: WXSS
- **动画**: `wx.createAnimation` API
- **实时通信**: WebSocket

## 目录结构

```
miniprogram/
├── app.ts                  # 小程序入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式
│
├── pages/                  # 主包页面
│   └── welcome/            # 欢迎页 - 首页入口
│
├── packageA/               # 分包 A - 房间和游戏
│   └── pages/
│       ├── waiting-room/   # 等待房间 - 创建/加入房间
│       └── drum-room/      # 震天鼓 - 10秒点击竞争
│
├── packageB/               # 分包 B - 聊天和判决
│   └── pages/
│       ├── chat-room/      # 对簿公堂 - 轮流语音申冤
│       ├── verdict-waiting/ # 等待判决 - AI分析loading
│       └── verdict/        # 判决书 - AI判决结果展示
│
├── components/             # 自定义组件
│   ├── styled-button/      # 样式化按钮 (多色、动画、按压反馈)
│   ├── styled-title/       # 样式化标题 (描边、投影)
│   ├── countdown/          # 全屏倒计时遮罩
│   ├── avatar/             # 圆形头像 (入场动画 + 呼吸动画)
│   ├── radar-chart/        # 六维战力雷达图 (Canvas 2D)
│   ├── secret-modal/       # 密折弹窗 (底部半屏面板)
│   └── post-game-effect/   # 赛后互动特效 (全屏覆盖层)
│
├── services/               # 业务服务层
│   ├── websocket-manager.ts    # WebSocket 连接管理 (单例)
│   ├── room-service.ts         # HTTP 房间服务
│   ├── room-websocket-service.ts # WebSocket 房间服务
│   ├── drum-service.ts         # 击鼓游戏服务
│   ├── asr-service.ts          # ASR 语音识别服务
│   ├── sts-service.ts          # STS Token 服务
│   ├── verdict-service.ts      # AI 判决结果服务 (WS监听 + HTTP回退 + 缓存)
│   └── post-game-service.ts    # 赛后互动服务 (特效、共同退堂)
│
├── models/                 # 领域模型
│   ├── user.ts             # IUser
│   ├── room.ts             # IRoom, IParticipant
│   └── message.ts          # IMessage
│
├── types/                  # 类型定义
│   ├── websocket-common.ts      # WebSocket 通用类型
│   ├── room-websocket.ts        # 房间 WebSocket 类型
│   ├── drum-websocket.ts        # 震天鼓 WebSocket 类型
│   ├── asr-websocket.ts         # ASR WebSocket 类型
│   ├── emoji-websocket.ts       # 表情 WebSocket 类型
│   ├── room-api.ts              # 房间 HTTP API 类型
│   ├── sts-api.ts               # STS Token API 类型
│   ├── verdict.ts               # 判决结果前端类型
│   ├── verdict-ws.ts            # 判决 WebSocket 类型
│   └── verdict-waiting.ts       # 判决等待页类型
│
├── constants/              # 常量配置
│   └── config.ts           # API_URL, WS_URL 等
│
├── utils/                  # 工具函数
│   ├── time.ts             # 时间格式化
│   ├── audio.ts            # 音频处理
│   ├── haptic.ts           # 触觉反馈
│   ├── random.ts           # 随机数生成
│   └── util.ts             # 通用工具
│
└── assets/                 # 静态资源
    └── images/             # 图片资源
```

## 页面流程

```
Welcome (欢迎页)
    ↓ 点击「我要申冤！」
Waiting Room (等待房间)
    ↓ 双方就位
Drum Room (震天鼓抢麦)
    ↓ 3秒倒计时 + 10秒点击
    ↓ 游戏结束
Chat Room (对簿公堂)
    ↓ 轮流语音申冤
    ↓ 双方发言完毕
Verdict Waiting (等待判决)
    ↓ AI 分析 loading
    ↓ 收到判决结果
Verdict (判决书展示)
    ↓ 赛后互动 / 退堂
```

## 核心功能

### 1. 欢迎页 (Welcome)

- 入场动画序列 (5 阶段)
- 主 CTA「我要申冤！」
- 底部功能区 (设置、规则、反馈)

### 2. 等待房间 (Waiting Room)

- **创建者**: 创建房间 → 显示房间码 → 等待
- **被邀请者**: 输入房间码 → 加入房间
- WebSocket 实时同步状态
- 双方就位后自动跳转

### 3. 震天鼓 (Drum Room)

- 3 秒准备倒计时 (强制同步)
- 10 秒快速点击竞争
- 实时进度条显示双方分数
- 点击反馈: 动画 + 震动 + 音效 + 飞字
- 结果展示后跳转 Chat Room

### 4. 对簿公堂 (Chat Room)

- **顶部倒计时**: 颜色、动画变化（绿色→黄色→红色）
- **发言舞台区域**:
    - 本地语音识别文字实时显示（Partial + Final）
    - 对方语音识别文字实时显示（通过 WebSocket 同步）
- **麦克风按钮**: 可发言/录音中/禁用三种状态
- **表情互动系统**: 仅监听方可用，实时飘屏动画
- **ASR 语音识别**:
    - 客户端直连腾讯云 ASR
    - 实时语音转文字（边说边出字）
    - 通过 WebSocket 同步给对方

### 5. 等待判决 (Verdict Waiting)

- **WebSocket 监听**: VERDICT_RESULT / VERDICT_FAILED 判决推送
- **多组并行动画**: 标题发光、鸭子浮动、小狗碰撞、齿轮旋转、粒子上升
- **随机加载文案轮播**: 30 条趣味文案，每 3 秒切换
- **超时处理**: 90 秒超时显示重试叠层
- **失败重试**: 发送 VERDICT_RETRY，最多 3 次
- **最小展示时间**: 5 秒防闪烁
- 收到结果后跳转至判决展示页

### 6. 判决书 (Verdict)

- **数据来源优先级**: verdictService 缓存 → globalData → HTTP 回退
- **标题区**: 红色背景 + 鸭子图标 + 案件编号
- **责任分布**: 三列布局（双方百分比 + 第三方因素）
- **六维战力雷达图**: Canvas 2D 绘制 + 展开动画
- **大老爷赠言**: 打字机效果逐字显示
- **惩罚令牌**: 盖章动画 + 震动反馈
- **密折弹窗**: 半屏弹窗，仅显示当前用户私密反馈
- **保存判决书图片**: 离屏 Canvas 生成 + 保存到相册
- **赛后互动**: 赢家惩戒 / 输家求饶 / 平局退堂 (WebSocket 双向通信)
- **入场动画序列**: 3.5s 依次展开

## 组件说明

### styled-button

可复用的样式化按钮组件。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | string | '' | 按钮文字 |
| `color` | string | 'red' | 颜色 (red/yellow/blue/gray) |
| `icon` | string | '' | 图标路径 |
| `disabled` | boolean | false | 禁用状态 |

**事件**: `bind:tap`

### styled-title

可复用的样式化标题组件。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | string | '' | 标题文字 |
| `animation` | object | {} | 动画数据 |
| `hidden` | boolean | false | 初始隐藏 |

### countdown

全屏倒计时遮罩组件。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `count` | number | 3 | 倒计时秒数 |
| `show` | boolean | false | 是否显示 |

**事件**: `bind:complete` - 倒计时完成回调

### avatar

圆形头像组件，支持入场动画和呼吸动画。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | string | '' | 头像图片 URL |
| `badge` | string | '👑' | 徽标 emoji |
| `size` | number | 220 | 头像直径 (rpx) |
| `playEntrance` | boolean | false | 触发入场动画 |
| `entranceDelay` | number | 0 | 入场延迟 (ms) |
| `breathing` | boolean | true | 是否启用呼吸动画 |

**动画**: 入场 (scale+fade-in) + 呼吸 (周期性 scale 振荡)，均使用 `wx.createAnimation()`

### radar-chart

六维战力雷达图组件，使用 Canvas 2D 绘制。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hostScores` | IDimensionScores | {} | 房主六维分数 |
| `guestScores` | IDimensionScores | {} | 嘉宾六维分数 |
| `size` | number | 500 | Canvas 宽度 (rpx) |

**公共方法**: `draw()` - 由父页面在 onReady 后调用，触发展开动画绘制

### secret-modal

密折弹窗组件，底部弹出的半屏面板。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | boolean | false | 是否显示 |
| `title` | string | '' | 封号标题 |
| `advice` | string | '' | 锦囊妙计内容 |
| `topDimension` | string | '' | 最高维度名称 |
| `topScore` | number | 0 | 最高维度分数 |

**事件**: `bind:close` - 关闭弹窗回调

### post-game-effect

赛后互动特效组件，全屏覆盖层。

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | boolean | false | 是否显示 |
| `type` | string | '' | 特效类型 (`stamp_death` / `beg_emoji`) |

**动画**: 惩戒 (scale+fade+震动) / 求饶 (slideUp+fade+震动)，使用 `wx.createAnimation()`

## 服务层 (Services)

### WebSocketManager (单例)

```typescript
import { WebSocketManager } from './services/websocket-manager';

const wsManager: WebSocketManager = WebSocketManager.getInstance();
wsManager.connect(url);
wsManager.registerHandler('JOIN_ACK', handler);
wsManager.send({ type: 'JOIN_ROOM', data: {...} });
wsManager.unregisterHandler('JOIN_ACK');
```

**特性**:

- 心跳机制保持连接
- 断线自动重连 (最大重试次数限制)
- 消息类型路由

### RoomService

```typescript
import { RoomService } from './services/room-service';

const room = await RoomService.createRoom(userId, nickname);
```

### DrumService

```typescript
import { drumService } from './services/drum-service';

drumService.registerHandlers();
drumService.sendTap(roomId, role, delta);
drumService.unregisterHandlers();
```

### ASRService

```typescript
import { asrService } from './services/asr-service';

// 推送识别文本到服务器
asrService.sendPartial('我认为...'); // 实时文本
asrService.sendFinal('我认为这样不对'); // 最终文本

// 重置序列号（新的录音会话）
asrService.resetSequence();
```

### STSService

```typescript
import { stsService } from './services/sts-service';

// 获取腾讯云临时凭证
const credentials = await stsService.getCredentials();
// {
//   token: string,
//   tmpSecretId: string,
//   tmpSecretKey: string,
//   expiredTime: number
// }
```

### VerdictService

```typescript
import { verdictService } from './services/verdict-service';

// 注册 WebSocket 监听（verdict-waiting 页面 onLoad 调用）
verdictService.startListening({
    onResult: result => {
        /* 处理判决结果 */
    },
    onError: payload => {
        /* 处理判决失败 */
    },
});

// 获取缓存的判决结果
const result = verdictService.getResult();

// HTTP 回退获取判决（断线重连场景）
const verdict = await verdictService.fetchVerdict(roomId);

// 清理缓存和回调
verdictService.clear();
```

### PostGameService

```typescript
import { postGameService } from './services/post-game-service';

// 初始化 WebSocket 监听
postGameService.initialize();

// 发送赛后互动操作
postGameService.sendAction(roomId, 'execute_punishment', remainingCount);
postGameService.sendAction(roomId, 'beg_for_mercy', remainingCount);

// 注册特效回调
postGameService.onEffect(effect => {
    /* 播放特效动画 */
});

// 清理回调
postGameService.destroy();
```

## ASR 语音识别架构

本项目采用**客户端直连架构**实现实时语音转文字功能：

```
┌─────────────────┐
│   Chat Room     │
│   (发言者)       │
└────────┬────────┘
         │
         │ 1. 获取 STS Token
         ↓
┌─────────────────┐
│  STS Service    │──► GET /tencent/credentials
└────────┬────────┘
         │
         │ 2. 使用临时凭证连接
         ↓
┌─────────────────┐
│  腾讯云 ASR      │
│  WebSocket      │
└────────┬────────┘
         │
         │ 3. 返回识别结果
         ↓
┌─────────────────┐
│  ASR Service    │
│  (本地显示)      │
└────────┬────────┘
         │
         │ 4. 推送文本到服务器
         ↓
┌─────────────────┐
│  WebSocket      │──► ASR_TEXT_PUSH
│  (后端服务器)    │
└────────┬────────┘
         │
         │ 5. 广播给对方
         ↓
┌─────────────────┐
│  Chat Room      │◄─── ASR_TEXT
│  (听众)          │
└─────────────────┘
```

### 工作流程

1. **获取临时凭证**: 页面加载时调用 `GET /tencent/credentials`
2. **连接腾讯云 ASR**: 使用 STS Token 初始化腾讯云语音识别插件
3. **本地语音识别**: 客户端直接与腾讯云通信，获得实时识别结果
4. **推送识别文本**: 通过 `ASR_TEXT_PUSH` 消息发送给后端
5. **广播给对方**: 后端进行去重、节流后通过 `ASR_TEXT` 广播

### 优势

- ✅ **低延迟**: 客户端直连腾讯云，无服务器中转
- ✅ **高可用**: 后端故障不影响语音识别功能
- ✅ **安全**: 使用临时凭证，永久密钥不暴露
- ✅ **实时体验**: 边说边显示，即时反馈

### WebSocket 消息类型

| 消息类型             | 方向            | 说明             |
| -------------------- | --------------- | ---------------- |
| `JOIN_ROOM`          | Client → Server | 加入房间         |
| `JOIN_ACK`           | Server → Client | 确认加入（广播） |
| `CHAT_SEND`          | Client → Server | 发送文本消息     |
| `CHAT_RECEIVE`       | Server → Client | 接收消息（广播） |
| `EMOJI_SEND`         | Client → Server | 发送表情         |
| `EMOJI_RECEIVE`      | Server → Client | 接收表情（广播） |
| `ASR_TEXT_PUSH`      | Client → Server | 推送识别文本     |
| `ASR_TEXT`           | Server → Client | 广播识别文本     |
| `DRUM_READY`         | Server → Client | 游戏准备         |
| `DRUM_START`         | Server → Client | 游戏开始         |
| `DRUM_TAP`           | Bidirectional   | 点击事件         |
| `DRUM_FINISH`        | Server → Client | 游戏结束         |
| `DRUM_RESULT`        | Server → Client | 最终结果         |
| `SPEECH_TURN_END`    | Client → Server | 发言轮次结束     |
| `SPEECH_TURN_SWITCH` | Server → Client | 切换发言轮次     |
| `CHAT_COMPLETE`      | Server → Client | 双方发言完毕     |
| `VERDICT_RESULT`     | Server → Client | 判决结果推送     |
| `VERDICT_FAILED`     | Server → Client | 判决生成失败     |
| `VERDICT_RETRY`      | Client → Server | 请求重试判决     |
| `POST_GAME_ACTION`   | Client → Server | 赛后互动操作     |
| `POST_GAME_EFFECT`   | Server → Client | 赛后互动特效     |
| `LEAVE_ROOM`         | Client → Server | 离开房间         |
| `LEAVE_ROOM_ACK`     | Server → Client | 离开房间确认     |
| `ERROR`              | Server → Client | 错误通知         |

---

## 开发规范

### TypeScript

```typescript
// ✅ 正确 - 显式类型
const count: number = 0;
const name: string = 'user';
function add(a: number, b: number): number {
    return a + b;
}

// ❌ 错误 - 缺少类型
const count = 0;
function add(a, b) {
    return a + b;
}
```

- 禁止使用 `any`，用 `unknown` + 类型守卫
- 接口前缀 `I` (IUser, IRoom)
- 未使用参数前缀 `_`

### 动画

```typescript
// ✅ 必须使用 wx.createAnimation
const animation = wx.createAnimation({
    duration: 1000,
    timingFunction: 'ease',
});
animation.translateX(100).step();
this.setData({ animationData: animation.export() });
```

```xml
<!-- WXML -->
<view animation="{{ animationData }}"></view>
```

**禁止使用 CSS animations/transitions**

### WXML

- `wx:for` 必须使用 `wx:key` (不用 index)
- 使用 `data-*` 传递事件数据
- 逻辑放在 TypeScript，模板保持简洁

### WXSS

- 使用 `rpx` 响应式单位 (750rpx = 屏幕宽度)
- BEM 命名: `.block__element--modifier`
- 禁止使用 `!important`

## 生命周期

### Page 生命周期

```typescript
Page({
    onLoad(options) {
        // 页面加载，注册 WebSocket 处理器
    },
    onShow() {
        // 页面显示
    },
    onReady() {
        // 页面初次渲染完成
    },
    onHide() {
        // 页面隐藏
    },
    onUnload() {
        // 页面卸载，注销 WebSocket 处理器
    },
});
```

### WebSocket 处理器注册/注销

```typescript
// onLoad 中注册
WebSocketManager.getInstance().registerHandler('DRUM_TAP', this.handleDrumTap);

// onUnload 中注销
WebSocketManager.getInstance().unregisterHandler('DRUM_TAP');
```

## 依赖插件

### 腾讯云实时语音识别插件

本项目使用腾讯云官方语音识别插件：

```json
{
    "plugins": {
        "QCloudAIVoice": {
            "version": "latest",
            "provider": "wxee1a5830fc02fadc"
        }
    }
}
```

**使用**:

```typescript
const QCloudAIVoicePlugin = requirePlugin('QCloudAIVoice');
const manager = QCloudAIVoicePlugin.speechRecognizerManager();

// 初始化
manager.init({
    secretId: credentials.tmpSecretId,
    secretKey: credentials.tmpSecretKey,
    token: credentials.token,
});

// 监听识别结果
manager.OnRecognitionResultChange = res => {
    const text = res.result?.voice_text_str;
    // 处理实时识别文本
};

manager.OnRecognitionComplete = res => {
    const text = res.result?.voice_text_str;
    // 处理最终识别文本
};
```

---

## 文档

详细文档请查看 `docs/miniprogram/`:

- [欢迎页](../docs/miniprogram/welcome.md)
- [等待房间](../docs/miniprogram/waiting-room.md)
- [震天鼓](../docs/miniprogram/drum-room.md)
- [对簿公堂](../docs/miniprogram/chat-room.md)
- [判决书](../docs/miniprogram/verdict.md)
- [组件文档](../docs/miniprogram/components.md)
- [服务文档](../docs/miniprogram/services.md)

## 许可证

ISC
