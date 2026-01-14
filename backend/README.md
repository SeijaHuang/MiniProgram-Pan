## 后端服务说明

本目录为小程序项目的 **Node.js/TypeScript 后端服务**，提供基础 HTTP 接口和 WebSocket 通信能力，主要用于：

- **健康检查**：用于小程序或部署平台探活。
- **WebSocket 通信**：实现与前端的小程序之间的双向实时通信（当前为简单回声 / 测试逻辑）。

## 技术栈

- **运行环境**：Node.js
- **语言**：TypeScript
- **HTTP 框架**：Express 5
- **WebSocket**：ws

## 目录结构

- `src/app.ts`：Express 应用实例，包含 `/health` 等 HTTP 路由。
- `src/index.ts`：后端入口文件，创建 HTTP 服务器并挂载 WebSocket。
- `src/ws.ts`：WebSocket 服务器初始化与消息处理逻辑。
- `scripts/ws-test.ts`：用于本地测试 WebSocket 的脚本。

## 安装与启动

在项目根目录或 `backend` 目录下执行以下命令（确保已安装依赖）：

```bash
# 进入 backend 目录
cd backend

# 安装依赖（首次使用时）
npm install

# 开发模式启动
npm run dev
```

服务默认监听端口：

- HTTP：`http://localhost:8080`
- WebSocket：`ws://localhost:8080/ws`

你可以通过以下方式简单验证：

- 浏览器访问 `http://localhost:8080/health`，应返回 `{ ok: true }`。
- 使用 WebSocket 客户端（如浏览器扩展、VSCode 插件或 `scripts/ws-test.ts`）连接 `ws://localhost:8080/ws`，发送 JSON 消息，服务器会在原消息基础上附加 `serverTs` 字段后回发。

## 开发规范

- 使用 `eslint` + `prettier` 统一代码风格：

```bash
npm run lint       # 检查
npm run lint:fix   # 自动修复
npm run format     # 按 prettier 规则格式化
```

如需扩展业务逻辑，可以在 `src/app.ts` 中新增 HTTP 路由，或在 `src/ws.ts` 中扩展 WebSocket 消息类型与处理分支。

