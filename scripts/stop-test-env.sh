#!/bin/bash

# Скрипт для остановки тестового окружения LeavePilot

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🛑 Остановка тестового окружения LeavePilot..."
echo ""

# Остановка LeavePilot если запущен
if [ -f /tmp/leavepilot-test.pid ]; then
  APP_PID=$(cat /tmp/leavepilot-test.pid)
  if ps -p $APP_PID > /dev/null 2>&1; then
    echo "🌐 Остановка LeavePilot (PID: $APP_PID)..."
    kill $APP_PID
    rm /tmp/leavepilot-test.pid
    echo "   ✅ LeavePilot остановлен"
  fi
fi

# Остановка docker контейнеров
echo "🐳 Остановка Docker контейнеров..."

# Определяем команду docker-compose
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

cd "$PROJECT_DIR"
$DOCKER_COMPOSE -f docker-compose.testing.yml down

echo ""
echo "✅ Тестовое окружение остановлено!"
echo ""
echo "💡 Для удаления данных используйте:"
echo "   docker compose -f docker-compose.testing.yml down -v"
echo ""
