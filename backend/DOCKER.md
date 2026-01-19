# Docker 部署指南 - 聊天室后端

## 🚀 快速开始

### Windows 用户

双击运行 `start-docker.bat` 或在 PowerShell 中执行：

```powershell
.\start-docker.bat
```

### Mac/Linux 用户

```bash
chmod +x start-docker.sh
./start-docker.sh
```

### 或使用 docker-compose

```bash
# 开发环境（支持热重载）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📋 Docker镜像说明

### Dockerfile.dev - 开发环境

- 包含所有依赖（含devDependencies）
- 支持热重载
- 挂载源代码目录
- 使用`ts-node`直接运行TypeScript

### Dockerfile - 生产环境

- 多阶段构建，优化镜像大小
- 只包含生产依赖
- TypeScript编译为JavaScript
- 使用编译后的`dist`目录运行

## 🔧 环境变量配置

在 `docker-compose.yml` 中配置：

```yaml
environment:
  - PORT=8080              # HTTP服务器端口
  - NODE_ENV=development   # 环境：development/production
  - WS_PATH=/ws           # WebSocket路径
  - LOG_LEVEL=debug       # 日志级别
```

## 📦 常用命令

| 操作 | 命令 |
|------|------|
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 查看日志 | `docker-compose logs -f` |
| 实时日志 | `docker-compose logs -f backend` |
| 重启服务 | `docker-compose restart` |
| 重新构建 | `docker-compose up --build` |
| 进入容器 | `docker-compose exec backend sh` |
| 查看状态 | `docker-compose ps` |

## 🧪 测试连接

### 1. 测试HTTP API

```bash
# 创建房间
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{
    "creator": {
      "userId": "user_test",
      "nickname": "Test User"
    }
  }'
```

### 2. 测试WebSocket

使用Postman：
1. 创建WebSocket Request
2. URL: `ws://localhost:8080/ws`
3. Connect
4. 发送JOIN_ROOM消息（见README.md）

### 3. 健康检查

```bash
curl http://localhost:8080/health
# 预期响应: {"ok":true}
```

## ⚠️ 故障排查

### 问题 1: 端口被占用

**错误信息**：
```
Error starting userland proxy: listen tcp4 0.0.0.0:8080: bind: address already in use
```

**解决方法**：

Windows:
```powershell
# 查找占用端口的进程
netstat -ano | findstr :8080

# 终止进程 (替换 <PID>)
taskkill /PID <PID> /F
```

Mac/Linux:
```bash
# 查找并终止占用端口的进程
lsof -ti:8080 | xargs kill -9
```

或修改 docker-compose.yml 使用其他端口。

### 问题 2: Docker Desktop 未启动

**错误信息**：
```
Cannot connect to the Docker daemon
```

**解决方法**：
1. 启动 Docker Desktop
2. 等待 Docker 完全启动（任务栏图标稳定）
3. 重新运行 `docker-compose up -d`

### 问题 3: 代码修改未生效

**解决方法**：

```bash
# 方法 1: 重启容器
docker-compose restart

# 方法 2: 重新构建
docker-compose up --build

# 方法 3: 完全重建
docker-compose down
docker-compose up --build
```

### 问题 4: 查看详细错误

```bash
# 查看实时日志
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 进入容器查看
docker-compose exec backend sh
```

## 📦 生产部署

### 方法1: 使用生产Dockerfile

```bash
# 构建镜像
docker build -t chatroom-backend:latest -f Dockerfile .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e WS_PATH=/ws \
  --name chatroom-backend \
  --restart unless-stopped \
  chatroom-backend:latest
```

### 方法2: Docker Compose生产配置

创建 `docker-compose.prod.yml`：

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile  # 使用生产Dockerfile
    container_name: chatroom-backend-prod
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - WS_PATH=/ws
    restart: always
    networks:
      - chatroom-network

networks:
  chatroom-network:
    driver: bridge
```

运行：
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔍 监控和维护

### 查看容器状态
```bash
docker-compose ps
docker stats chatroom-backend
```

### 清理未使用的资源
```bash
# 清理停止的容器
docker container prune

# 清理未使用的镜像
docker image prune

# 清理所有未使用资源
docker system prune -a
```

### 备份和恢复

由于当前版本不持久化数据，重启会丢失所有房间和消息。

未来如果添加数据库，可以使用Docker volumes进行备份。

## 📚 更多资源

- [完整API文档](./README.md)
- [架构说明](./ARCHITECTURE.md)
- [重构总结](./REFACTOR_SUMMARY.md)

---

## 🎯 快速参考

**开发环境**：
```bash
docker-compose up -d          # 启动
docker-compose logs -f        # 查看日志
docker-compose down          # 停止
```

**生产环境**：
```bash
docker build -t chatroom-backend -f Dockerfile .
docker run -d -p 8080:8080 chatroom-backend
```

**测试连接**：
```bash
curl http://localhost:8080/health
```


## 💡 最佳实践

1. **开发环境**：使用 `Dockerfile.dev` + volume 映射（支持热重载）
2. **生产环境**：使用 `Dockerfile`（优化的生产镜像）
3. **日志查看**：保持 `docker-compose logs -f` 终端打开
4. **测试前确认**：运行 `curl http://localhost:8080/health` 验证服务
5. **清理资源**：定期运行 `docker system prune` 清理未使用的镜像

## 🔗 相关链接

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [项目 README](./README.md)
- [测试指南](./TESTING.md)
