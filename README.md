# 微信小程序项目

基于微信小程序原生框架开发的 TypeScript 项目，支持双人实时互动功能。

## 技术栈

- **框架**: 微信小程序原生框架（不使用 React / Vue / uni-app）
- **语言**: TypeScript
- **模板**: WXML
- **样式**: WXSS
- **动画**: `wx.createAnimation` API
- **实时通信**: WebSocket
- **代码规范**: ESLint + Prettier

## 项目结构

```
miniprogram/
├── app.ts              # 小程序入口文件
├── app.json            # 小程序全局配置
├── app.wxss            # 全局样式
├── pages/              # 页面目录
│   ├── welcome/        # 欢迎页（首页）
│   ├── waiting-room/   # 房间创建 & 等待页
│   ├── drum/           # 击鼓页面
│   ├── chat-room/      # Chat Room（对簿公堂）页面
│   └── logs/           # 日志页
├── components/         # 组件目录（自定义组件）
│   ├── styled-button/  # 样式化按钮组件
│   └── styled-title/   # 样式化标题组件
├── services/           # 业务逻辑、API 调用
└── utils/              # 工具函数目录
```

## 开发环境要求

- Node.js >= 14.0.0
- 微信开发者工具
- npm 或 yarn

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化 Husky（用于 Git hooks）

```bash
npm run prepare
```

### 3. 在微信开发者工具中打开项目

- 打开微信开发者工具
- 选择"导入项目"
- 选择项目根目录
- 填写 AppID（可在 `project.config.json` 中配置）

## 开发规范

### 代码风格

- 使用 **TypeScript** 编写所有逻辑代码
- 使用 **WXML** 编写页面结构
- 使用 **WXSS** 编写样式
- 代码缩进：**4 个空格**
- 使用 **单引号**

### 动画实现

所有动画统一使用 `wx.createAnimation` API 实现：

```typescript
// 创建动画实例
const animation = wx.createAnimation({
    duration: 1000,
    timingFunction: 'ease',
});

// 设置动画效果
animation.translateX(100).step();

// 应用动画
this.setData({
    animationData: animation.export(),
});
```

### WebSocket 实时通信

项目使用 WebSocket 实现双人实时互动功能。建议在 `utils/` 目录下创建 WebSocket 管理类：

```typescript
// utils/websocket.ts
class WebSocketManager {
    private socketTask: WechatMiniprogram.SocketTask | null = null;

    connect(url: string) {
        this.socketTask = wx.connectSocket({
            url: url,
            success: () => {
                console.log('WebSocket 连接成功');
            },
        });

        this.socketTask.onMessage(res => {
            // 处理消息
            console.log('收到消息:', res.data);
        });
    }
}
```

### 目录规范

- **页面**: 放置在 `miniprogram/pages/` 目录下，每个页面包含 `.ts`、`.wxml`、`.wxss`、`.json` 四个文件
- **组件**: 放置在 `miniprogram/components/` 目录下，结构与页面相同
    - `styled-button`: 可复用的样式化按钮组件，支持多种颜色主题和动画效果
    - `styled-title`: 可复用的样式化标题组件，支持动画绑定
- **服务层**: 放置在 `miniprogram/services/` 目录下，处理业务逻辑和 API 调用
- **工具函数**: 放置在 `miniprogram/utils/` 目录下，纯函数，无副作用

## 代码检查

项目集成了 ESLint 和 Prettier，会在每次 commit 前自动检查代码。

### 手动运行

```bash
# 检查代码
npm run lint

# 自动修复代码问题
npm run lint:fix

# 格式化代码
npm run format

# 检查代码格式
npm run format:check
```

### Pre-commit Hook

每次 `git commit` 时，会自动：

- ✅ 检查未使用的导入和变量
- ✅ 检查是否使用了 `any` 类型
- ✅ 检查代码格式是否符合 Prettier 规范
- ✅ 自动修复可修复的问题

如果检查失败，commit 会被阻止，需要先修复错误。

## 文档

### 页面文档

项目包含以下页面的详细实现文档：

- **欢迎页（Welcome）**: `docs/welcome.md` - 首页入口，包含角色展示和主 CTA 按钮
- **等待页（Waiting Room）**: `docs/waiting-room.md` - 房间创建和等待对方加入的页面
- **Chat Room（对簿公堂）**: `docs/chat-room.md` - 核心对簿与情绪释放页面，支持双方轮流语音申冤、表情互动和倒计时控制

每个页面文档包含：

- 页面目标和用户心理状态
- 页面结构和布局说明
- 核心视觉元素和交互细节
- 状态管理和跳转逻辑
- 实现状态和后续规划

### 组件文档

- **组件索引**: `docs/components.md` - 所有自定义组件的详细说明
    - **Styled Button** (`styled-button`) - 可复用的样式化按钮组件
        - 支持多种颜色主题（红、黄、蓝、灰）
        - 支持图标和文字
        - 光线扫过动画效果
        - 按压反馈效果
    - **Styled Title** (`styled-title`) - 可复用的样式化标题组件
        - 统一的大号粗体白色文字风格
        - 黑色描边和投影效果
        - 支持动画绑定和初始状态控制

详细使用方法和 API 说明请参考 `docs/components.md`。

## 开发注意事项

1. **不使用任何第三方框架**: 项目仅使用微信小程序原生 API
2. **TypeScript 严格模式**: 已启用 TypeScript 严格类型检查
3. **禁止使用 any**: ESLint 会检查并阻止使用 `any` 类型
4. **动画实现**: 统一使用 `wx.createAnimation`，不使用 CSS 动画
5. **实时通信**: 使用 WebSocket 实现双人实时互动
6. **页面复用**: Waiting Room 页面同时服务于创建者和被邀请者，通过角色判断显示不同按钮

## 文件说明

- `.eslintrc.json`: ESLint 配置
- `.prettierrc.json`: Prettier 配置
- `.husky/pre-commit`: Git pre-commit hook
- `.lintstagedrc.json`: lint-staged 配置
- `tsconfig.json`: TypeScript 配置

## 许可证

[MIT License]
