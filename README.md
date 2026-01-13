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
│   ├── index/          # 首页
│   └── logs/           # 日志页
├── components/         # 组件目录（自定义组件）
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

        this.socketTask.onMessage((res) => {
            // 处理消息
            console.log('收到消息:', res.data);
        });
    }
}
```

### 目录规范

- **页面**: 放置在 `miniprogram/pages/` 目录下
- **组件**: 放置在 `miniprogram/components/` 目录下
- **工具函数**: 放置在 `miniprogram/utils/` 目录下

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

## 开发注意事项

1. **不使用任何第三方框架**: 项目仅使用微信小程序原生 API
2. **TypeScript 严格模式**: 已启用 TypeScript 严格类型检查
3. **禁止使用 any**: ESLint 会检查并阻止使用 `any` 类型
4. **动画实现**: 统一使用 `wx.createAnimation`，不使用 CSS 动画
5. **实时通信**: 使用 WebSocket 实现双人实时互动

## 文件说明

- `.eslintrc.json`: ESLint 配置
- `.prettierrc.json`: Prettier 配置
- `.husky/pre-commit`: Git pre-commit hook
- `.lintstagedrc.json`: lint-staged 配置
- `tsconfig.json`: TypeScript 配置

## 许可证

[MIT License]
