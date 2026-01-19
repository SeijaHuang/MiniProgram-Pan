#!/bin/bash

echo "🚀 Starting MiniProgram Backend with Docker..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# 启动服务
echo "📦 Starting containers..."
docker-compose up -d

# 等待服务启动
echo "⏳ Waiting for service to start..."
sleep 3

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo "✅ Backend is running!"
    echo ""
    echo "📝 Service Info:"
    echo "   HTTP:      http://localhost:8080"
    echo "   WebSocket: ws://localhost:8080/ws"
    echo "   Health:    http://localhost:8080/health"
    echo ""
    echo "📊 View logs:  docker-compose logs -f"
    echo "🛑 Stop:       docker-compose down"
else
    echo "❌ Failed to start backend"
    docker-compose logs
    exit 1
fi
