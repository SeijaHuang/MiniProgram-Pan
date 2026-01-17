# Docker 快速指南

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
docker-compose up -d
```

## 📋 常用命令

| 操作 | 命令 |
|------|------|
| 启动服务 | `docker-compose up -d` |
| 停止服务 | `docker-compose down` |
| 查看日志 | `docker-compose logs -f` |
| 重启服务 | `docker-compose restart` |
| 重新构建 | `docker-compose up --build` |
| 进入容器 | `docker-compose exec backend sh` |

## 🔧 配置说明

### 端口映射

默认端口：`8080`

修改端口：编辑 `docker-compose.yml`
```yaml
ports:
  - "8081:8080"  # 主机端口:容器端口
```

### 环境变量

在 `docker-compose.yml` 的 `environment` 部分修改：

```yaml
environment:
  - PORT=8080
  - NODE_ENV=development
  - WS_PATH=/ws
  - LOG_LEVEL=debug
```

### 代码热重载

代码修改后会自动重启服务（通过 volume 映射实现）。

如果修改未生效，手动重启：
```bash
docker-compose restart
```

## 🧪 测试 WebSocket

### 使用 Postman

1. 确保 Docker 服务正在运行
2. 打开 Postman
3. 创建 WebSocket Request
4. 连接到：`ws://localhost:8080/ws`
5. 发送测试消息（见 README.md）

### 使用浏览器

打开浏览器 Console：
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
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

### 使用生产 Dockerfile

```bash
# 构建镜像
docker build -t miniprogram-backend:latest -f Dockerfile .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  --name miniprogram-backend \
  --restart unless-stopped \
  miniprogram-backend:latest
```

### 使用 Docker Compose (生产)

修改 `docker-compose.yml`：
```yaml
services:
  backend:
    build:
      dockerfile: Dockerfile  # 使用生产 Dockerfile
    environment:
      - NODE_ENV=production
    # 移除 volumes (代码热重载)
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
