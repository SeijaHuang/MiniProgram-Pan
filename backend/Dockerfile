# 多阶段构建 - 生产环境
# 阶段1: 构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装所有依赖（包括devDependencies用于构建）
RUN npm ci

# 复制源代码
COPY src ./src

# 编译 TypeScript
RUN npm run build

# 阶段2: 生产镜像
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist

# 复制 .env.example (运行时可以覆盖)
COPY .env.example .env

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
