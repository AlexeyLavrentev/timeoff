# Настройка Docker Compose для тестирования SSO с Keycloak

## Структура docker-compose.testing.yml

```yaml
services:
  # PostgreSQL - база данных для LeavePilot (опционально)
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]

  # Keycloak - SSO сервер (использует встроенную H2 для тестирования)
  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    ports: ["8080:8080"]
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin

  # MailPit - SMTP сервер для тестирования email
  mailpit:
    image: axllent/mailpit:latest
    ports: ["8025:8025", "1025:1025"]

  # Redis для сессий
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

## Запуск тестового окружения

```bash
# Запустить все сервисы
docker compose -f docker-compose.testing.yml up -d

# Проверить статус
docker compose -f docker-compose.testing.yml ps

# Остановить
docker compose -f docker-compose.testing.yml down
```

## Доступ к сервисам

| Сервис | URL | Логин | Пароль |
|--------|-----|-------|--------|
| Keycloak Admin | http://localhost:8080/admin | admin | admin |
| Keycloak Realm | http://localhost:8080/realms/leavepilot | - | - |
| MailPit UI | http://localhost:8025 | - | - |
| MailPit SMTP | localhost:1025 | test | test |

## Настройка Keycloak для LeavePilot

### 1. Создать Realm

```
Admin Console → Create Realm → "leavepilot"
```

### 2. Создать Client

```
Admin Console → Clients → Create client
- Client ID: leavepilot
- Client authentication: ON
- Valid redirect URIs: http://localhost:3000/*
```

### 3. Настроить LeavePilot config

```json
{
  "sso": {
    "enabled": true,
    "provider": "keycloak",
    "keycloak": {
      "realm": "leavepilot",
      "url": "http://localhost:8080",
      "clientId": "leavepilot",
      "clientSecret": "<YOUR_CLIENT_SECRET>"
    }
  }
}
```

## Исправленные проблемы

### Проблема 1: Keycloak не подключается к PostgreSQL

**Причина**: Keycloak ожидал пользователя `keycloak` в базе, но postgres создавал только `timeoff`.

**Решение**: Использовать встроенную базу H2 для Keycloak в тестировании:

```yaml
# Было (НЕ работает):
KC_DB: postgres
KC_DB_URL: jdbc:postgresql://postgres/keycloak
KC_DB_USERNAME: keycloak
KC_DB_PASSWORD: keycloak_password

# Стало (работает):
# (без переменных KC_DB_* - используется H2 по умолчанию)
```

### Проблема 2: Конфликт портов

**Проверка занятых портов:**
```bash
lsof -i :8080  # Keycloak
lsof -i :8025  # MailPit UI
lsof -i :1025  # MailPit SMTP
```

## Тестирование SSO

### 1. Проверка health endpoints
```bash
# Keycloak
curl http://localhost:8080/health/ready

# MailPit
curl http://localhost:8025
```

### 2. Получение токена
```bash
export TOKEN=$(curl -s -X POST http://localhost:8080/realms/leavepilot/protocol/openid-connect/token \
  -d "client_id=leavepilot" \
  -d "grant_type=password" \
  -d "username=admin" \
  -d "password=admin" | jq -r '.access_token')
```

## Очистка

```bash
# Остановить и удалить все контейнеры
docker compose -f docker-compose.testing.yml down -v

# Удалить orphan контейнеры
docker compose -f docker-compose.testing.yml down --remove-orphans
```
