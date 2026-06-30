#!/bin/bash

# Скрипт для запуска тестового окружения LeavePilot
# Запускает: Docker контейнеры, настраивает Keycloak, запускает приложение

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Запуск тестового окружения LeavePilot..."
echo ""

# Проверка docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker не установлен. Пожалуйста установите Docker."
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose не установлен. Пожалуйста установите Docker Compose."
  exit 1
fi

# Определяем команду docker-compose
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

# Запуск docker контейнеров
echo "🐳 Запуск Docker контейнеров..."
cd "$PROJECT_DIR"
$DOCKER_COMPOSE -f docker-compose.testing.yml up -d

echo "⏳ Ожидание запуска контейнеров..."
sleep 5

# Проверка health status
echo "🔍 Проверка статуса контейнеров..."
for service in postgres keycloak mailpit redis; do
  if $DOCKER_COMPOSE -f docker-compose.testing.yml ps | grep -q "$service.*Up"; then
    echo "   ✅ $service запущен"
  else
    echo "   ❌ $service не запущен"
  fi
done

echo ""
echo "⏳ Ожидание готовности сервисов..."
sleep 10

# Настройка Keycloak
echo ""
echo "🔑 Настройка Keycloak..."
bash "$SCRIPT_DIR/setup-keycloak.sh"

# Создание базы данных для LeavePilot
echo ""
echo "🗄️ Создание базы данных..."
cd "$PROJECT_DIR"
DB_DIALECT=postgres \
DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=timeoff \
DB_USER=timeoff \
DB_PASSWORD=timeoff_password \
npm run db-update 2>/dev/null || echo "⚠️  База данных уже существует"

# Запуск LeavePilot
echo ""
echo "🌐 Запуск LeavePilot..."
export $(cat .env.testing | grep -v '^#' | xargs)
npm start &
APP_PID=$!

echo "   LeavePilot запущен с PID: $APP_PID"

# Сохраняем PID для последующей остановки
echo $APP_PID > /tmp/leavepilot-test.pid

echo ""
echo "🎉 Тестовое окружение запущено!"
echo ""
echo "📋 Доступные сервисы:"
echo "   🌐 LeavePilot:       http://localhost:3000"
echo "   🔑 Keycloak:         http://localhost:8080 (admin/admin)"
echo "   📧 MailPit Web UI:   http://localhost:8025"
echo "   🗄️ PostgreSQL:       localhost:5432"
echo "   🔴 Redis:            localhost:6379"
echo ""
echo "👤 Тестовые пользователи:"
echo "   Keycloak: testuser / Test123456!"
echo ""
echo "🛑 Для остановки используйте: ./scripts/stop-test-env.sh"
echo ""

# Небольшая пауза чтобы пользователь мог прочитать информацию
sleep 2

# Не завершаем скрипт, чтобы контейнеры продолжали работать
echo "⏳ Скрипт работает. Нажмите Ctrl+C для остановки..."
wait $APP_PID
