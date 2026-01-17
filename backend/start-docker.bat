@echo off
echo 🚀 Starting MiniProgram Backend with Docker...

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    exit /b 1
)

REM 启动服务
echo 📦 Starting containers...
docker-compose up -d

REM 等待服务启动
echo ⏳ Waiting for service to start...
timeout /t 3 /nobreak >nul

REM 检查服务状态
docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo ❌ Failed to start backend
    docker-compose logs
    exit /b 1
) else (
    echo ✅ Backend is running!
    echo.
    echo 📝 Service Info:
    echo    HTTP:      http://localhost:8080
    echo    WebSocket: ws://localhost:8080/ws
    echo    Health:    http://localhost:8080/health
    echo.
    echo 📊 View logs:  docker-compose logs -f
    echo 🛑 Stop:       docker-compose down
)
