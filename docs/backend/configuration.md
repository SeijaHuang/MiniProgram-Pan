# Backend Configuration

本文档描述后端服务的配置管理。

## 环境变量

### 配置文件

环境变量通过 `.env` 文件配置，参考 `.env.example`。

**文件位置**: `backend/.env.example`

### 可用配置项

#### 服务器配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 服务器端口 | `8080` |
| `NODE_ENV` | 运行环境 | `development` |

#### WebSocket 配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `WS_PATH` | WebSocket 路径 | `/ws` |
| `WS_HEARTBEAT_INTERVAL` | 心跳间隔 (毫秒) | `30000` |
| `WS_CLIENT_TIMEOUT` | 客户端超时 (毫秒) | `60000` |
| `WS_MAX_RECONNECT` | 最大重连次数 | `5` |

#### 游戏配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `GAME_ROOM_TIMEOUT` | 房间超时 (毫秒) | `300000` |
| `GAME_MOVE_TIMEOUT` | 操作超时 (毫秒) | `30000` |

#### 日志配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `LOG_LEVEL` | 日志级别 | `debug` |

### 示例配置

```env
# 服务器配置
PORT=8080
NODE_ENV=development

# WebSocket 配置
WS_PATH=/ws
WS_HEARTBEAT_INTERVAL=30000
WS_CLIENT_TIMEOUT=60000
WS_MAX_RECONNECT=5

# 游戏配置
GAME_ROOM_TIMEOUT=300000
GAME_MOVE_TIMEOUT=30000

# 日志配置
LOG_LEVEL=debug
```

---

## 常量配置

集中管理的应用常量。

**文件位置**: `backend/src/constants/config.ts`

### APP_CONFIG

应用基础配置：

```typescript
const APP_CONFIG = {
    PORT: process.env.PORT || 8080,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
};
```

### WS_CONFIG

WebSocket 配置：

```typescript
const WS_CONFIG = {
    PATH: process.env.WS_PATH || '/ws',
    HEARTBEAT_INTERVAL: Number(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    CLIENT_TIMEOUT: Number(process.env.WS_CLIENT_TIMEOUT) || 60000,
};
```

### ROOM_CONFIG

房间配置：

```typescript
const ROOM_CONFIG = {
    MAX_PARTICIPANTS: 2, // 每个房间最大人数
    ROOM_CODE_LENGTH: 6, // 房间码长度
    ROOM_TIMEOUT: Number(process.env.GAME_ROOM_TIMEOUT) || 300000,
};
```

---

## 环境变量加载

环境变量通过 `env-loader.ts` 加载和验证。

**文件位置**: `backend/src/utils/env-loader.ts`

```typescript
import dotenv from 'dotenv';

export function loadEnv(): void {
    const result = dotenv.config();

    if (result.error) {
        console.warn('No .env file found, using defaults');
    }

    // 可添加必需变量验证
    validateRequiredEnvVars();
}

function validateRequiredEnvVars(): void {
    const required: string[] = [
        // 添加必需的环境变量
    ];

    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
    }
}
```

---

## 数据库配置 (占位)

MongoDB 配置结构已准备好，等待实现。

**文件位置**: `backend/src/database/config/mongodb.config.ts`

```typescript
interface IMongoDBConfig {
    uri: string;
    dbName: string;
    options: {
        maxPoolSize: number;
        serverSelectionTimeoutMS: number;
        socketTimeoutMS: number;
    };
}

const mongoConfig: IMongoDBConfig = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'miniprogram-pan',
    options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    },
};
```

---

## Docker 配置

### docker-compose.yml

```yaml
version: '3.8'

services:
    backend:
        build:
            context: .
            dockerfile: Dockerfile.dev
        ports:
            - '8080:8080'
        environment:
            - NODE_ENV=development
            - PORT=8080
            - WS_PATH=/ws
        volumes:
            - .:/app
            - /app/node_modules
```

### Dockerfile.dev

开发环境 Docker 配置：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev"]
```

### Dockerfile

生产环境 Docker 配置：

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8080
CMD ["npm", "start"]
```

---

## 使用说明

### 本地开发

1. 复制环境变量模板：

```bash
cd backend
cp .env.example .env
```

2. 编辑 `.env` 文件（可选）

3. 启动开发服务器：

```bash
npm run dev
```

### Docker 开发

```bash
cd backend
docker-compose up
```

或使用启动脚本：

```bash
# Windows
start-docker.bat

# Linux/Mac
./start-docker.sh
```

### 生产部署

1. 设置环境变量（通过系统环境变量或 `.env` 文件）
2. 构建项目：

```bash
npm run build
```

3. 启动服务：

```bash
npm start
```

---

## 配置优先级

1. 系统环境变量 (最高优先级)
2. `.env` 文件
3. 代码中的默认值 (最低优先级)

---

## 安全注意事项

1. **不要提交 `.env` 文件**: 已添加到 `.gitignore`
2. **生产环境使用环境变量**: 不要在代码中硬编码敏感信息
3. **定期轮换密钥**: 如果配置了认证相关的密钥
4. **限制访问权限**: 确保配置文件权限正确
