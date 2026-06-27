# Развёртывание License Portal

Руководство по запуску License Portal как отдельного внутреннего сервиса вендора.

## Быстрый старт (development)

```bash
# Создать первого администратора
node bin/portal_admin.js create-admin --email admin@example.com --password secret123

# Запустить портал
node bin/license_portal.js
```

Откройте http://127.0.0.1:3001 и войдите.

## Переменные окружения

| Переменная | Обязательна | Описание |
|-----------|-------------|----------|
| `NODE_ENV` | нет | `production` для продакшена |
| `PORTAL_PORT` | нет | Порт (по умолчанию 3001) |
| `PORTAL_SESSION_SECRET` | в production | Секрет сессии (длинная случайная строка) |
| `PORTAL_SESSION_SECURE` | нет | `true` если за HTTPS |
| `PORTAL_SIGNING_PROVIDER` | нет | `file` (default), `vault`, `aws-kms`, `pkcs11`, `external` |
| `PORTAL_DB_STORAGE` | нет | Путь к SQLite файлу (по умолчанию `data/portal.sqlite`) |
| `PORTAL_LICENSE_PRIVATE_KEY_FILE` | в production | Путь к приватному ключу PEM |
| `PORTAL_LICENSE_PRIVATE_KEY` | alt | Приватный ключ PEM через env (не рекомендуется) |
| `PORTAL_LICENSE_PUBLIC_KEY_FILE` | в production | Путь к публичному ключу PEM |
| `PORTAL_LICENSE_PUBLIC_KEY` | alt | Публичный ключ PEM через env |

В production **все обязательные переменные должны быть установлены** — портал
не запустится без них.

## Провайдеры подписи

| Провайдер | Статус | Описание |
|-----------|--------|----------|
| `file` | **Реализован** | Подпись через PEM-файл приватного ключа |
| `vault` | Зарезервирован | HashiCorp Vault (будущее) |
| `aws-kms` | Зарезервирован | AWS KMS (будущее) |
| `pkcs11` | Зарезервирован | PKCS#11 / HSM (будущее) |
| `external` | Зарезервирован | Внешний сервис подписи (будущее) |

Провайдер выбирается через `PORTAL_SIGNING_PROVIDER` (по умолчанию `file`).
Для `file`-провайдера обязательны `PORTAL_LICENSE_PRIVATE_KEY_FILE` и
`PORTAL_LICENSE_PUBLIC_KEY_FILE`.

Приватный ключ **никогда не хранится в БД** и не передаётся клиенту.

## Docker Compose

### 1. Подготовка секретов

```bash
mkdir -p secrets

# Генерация ключей (один раз)
openssl genpkey -algorithm RSA -out secrets/license_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in secrets/license_private.pem -pubout -out secrets/license_public_key.pem

# Права доступа
chmod 600 secrets/license_private.pem
chmod 644 secrets/license_public_key.pem
```

### 2. Файл окружения

Создайте `.env.portal` (НЕ коммитить):

```env
PORTAL_SESSION_SECRET=<длинная-случайная-строка-минимум-32-символа>
PORTAL_PRIVATE_KEY_FILE=./secrets/license_private.pem
PORTAL_PUBLIC_KEY_FILE=./secrets/license_public_key.pem
PORTAL_PORT=3001
PORTAL_SESSION_SECURE=false
```

### 3. Запуск

```bash
# Создать администратора (первый раз)
docker compose -f docker-compose.portal.yml run --rm portal \
  node bin/portal_admin.js create-admin --email admin@example.com --password <password>

# Запустить сервис
docker compose -f docker-compose.portal.yml --env-file .env.portal up -d

# Проверить здоровье
curl http://127.0.0.1:3001/healthz

# Логи
docker compose -f docker-compose.portal.yml logs -f portal
```

## Администрирование

Пароли передаются через переменные окружения (`--password-env`), а не как
аргументы командной строки (защита от shell history и process list).

Все команды `create`, `disable`, `reset-password` записываются в аудит-лог
(portal AuditLog). Опциональный `--actor-email` указывает оператора; без
него используется `portal-admin-cli`.

```bash
# Создать первого администратора
PORTAL_ADMIN_PASSWORD=$(openssl rand -base64 16) node bin/portal_admin.js create \
  --email admin@example.com --password-env PORTAL_ADMIN_PASSWORD

# Создать с указанием роли и.actor
PORTAL_ADMIN_PASSWORD=secret12345678 node bin/portal_admin.js create \
  --email issuer@example.com --password-env PORTAL_ADMIN_PASSWORD \
  --role issuer --actor-email ops@example.com

# Список администраторов
node bin/portal_admin.js list

# Отключить администратора
node bin/portal_admin.js disable --email admin@example.com --actor-email ops@example.com

# Сбросить пароль
NEW_PASSWORD=newsecret12345678 node bin/portal_admin.js reset-password \
  --email admin@example.com --password-env NEW_PASSWORD --actor-email ops@example.com
```

Роли: `viewer`, `issuer`, `admin`. Пароль: минимум 12 символов.

### Аудит

| Команда | Действие в AuditLog | Детали |
|---------|---------------------|--------|
| `create` | `admin_user_create` | email, role, displayNamePresent |
| `disable` | `admin_user_disable` | email, role |
| `reset-password` | `admin_user_reset_password` | email, lockoutCleared |
| `list` | (не логируется) | — |

В деталях аудита **никогда** не хранятся пароли, хэши или токены.

## Reverse proxy

### Caddy

```
portal.internal {
    reverse_proxy 127.0.0.1:3001
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name portal.internal;

    ssl_certificate /etc/ssl/portal.crt;
    ssl_certificate_key /etc/ssl/portal.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

При использовании HTTPS установите `PORTAL_SESSION_SECURE=true`.

**Важно:** портал должен быть доступен только через VPN или внутреннюю сеть.
Никогда не экспонируйте его в публичный интернет.

## Healthcheck

```bash
curl http://127.0.0.1:3001/healthz
```

Ответ:

```json
{"ok": true, "service": "license-portal", "db": true}
```

Не содержит секретов, ключей, путей или данных лицензий.

## Резервное копирование

### Что бэкапить

| Компонент | Путь | Критичность |
|-----------|------|-------------|
| Portal DB | `data/portal.sqlite` | Критично |
| Приватный ключ | `secrets/license_private.pem` | Критично |
| Публичный ключ | `secrets/license_public_key.pem` | Важно |
| .env файл | `.env.portal` (без секретов в git) | Важно |

### Процедура бэкапа

```bash
# 1. Остановить портал (для консистентности SQLite)
docker compose -f docker-compose.portal.yml stop portal

# 2. Создать бэкап через скрипт
node bin/license_portal_backup.js --out-dir ./backups

# Или вручную
cp data/portal.sqlite backups/portal-$(date +%Y%m%d-%H%M%S).sqlite

# 3. Скопировать ключи
cp secrets/license_private.pem backups/
cp secrets/license_public_key.pem backups/

# 4. Запустить портал
docker compose -f docker-compose.portal.yml start portal
```

**Скрипт бэкапа** (`bin/license_portal_backup.js`):
- Копирует SQLite файл с таймстемпом в имени.
- Создаёт родительскую директорию если её нет.
- Отказывается перезаписывать существующий файл.
- Не печатает секреты, ключи или пароли.
- Предупреждает, что бэкап содержит пароли и blobs.

### Процедура восстановления

1. Остановить портал.
2. Скопировать бэкап БД в `data/portal.sqlite`:
   ```bash
   cp backups/portal-YYYYMMDD-HHMMSS.sqlite data/portal.sqlite
   ```
3. Восстановить ключи в `secrets/`.
4. Установить переменные окружения.
5. Запустить портал.
6. Проверить `/healthz`.
7. Войти как администратор.
8. Выпустить тестовую лицензию и проверить её через `bin/license.js verify`.

## Production checklist

- [ ] `PORTAL_SESSION_SECRET` установлен (длинная случайная строка)
- [ ] `NODE_ENV=production`
- [ ] Persistent session store активен (автоматически в production)
- [ ] Приватный ключ смонтирован read-only
- [ ] Портал не экспонирован в публичный интернет
- [ ] HTTPS/reverse proxy настроен
- [ ] `PORTAL_SESSION_SECURE=true` если за HTTPS
- [ ] Бэкап протестирован
- [ ] Администратор создан
- [ ] Секреты не в git
- [ ] Логи не содержат секретов
- [ ] `/healthz` возвращает `ok: true`

## CI

GitHub Actions (`core-ci.yml`) проверяет:

- `docker compose -f docker-compose.portal.yml config --quiet` — валидность compose файла
- `docker build -f Dockerfile.portal -t leavepilot-portal:ci .` — сборка образа

CI использует сгенерированные временные ключи и фейковые секреты. Настоящие
ключи и пароли в CI не передаются.

Для production развёртывания требуются настоящие секреты и HTTPS reverse proxy.
