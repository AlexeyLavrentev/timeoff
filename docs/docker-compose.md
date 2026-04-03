# Установка и запуск через Docker Compose

Это основной сценарий для:

- пилотного запуска внутри компании;
- внутреннего сервера;
- окружения, где сразу нужны `MySQL` и `Redis`;
- развёртывания, близкого к production.

## Что делает compose-конфигурация

`docker-compose.yml` поднимает:

- `db` — `MySQL 8`
- `redis` — `Redis 7`
- `app` — приложение TimeOff.Management

Контейнер приложения получает:

- `MySQL` как основную базу;
- `Redis` как хранилище сессий;
- конфиг из `config/app.redis.json`.

## Подготовка перед первым запуском

### 1. Создайте `.env`

```bash
cp .env.example .env
```

### 2. Обязательно поменяйте секреты и пароли

Минимально замените:

- `SESSION_SECRET`
- `CRYPTO_SECRET`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

### 3. При необходимости отредактируйте `config/app.redis.json`

Чаще всего меняют:

- `application_domain`
- `default_language`
- `supported_languages`
- `send_emails`
- `email_transporter`
- `allow_create_new_accounts`

Важно: при compose-запуске именно `config/app.redis.json` фактически становится рабочим `config/app.json` внутри контейнера.

## Как создается первый администратор

По умолчанию в compose-конфиге самостоятельная регистрация отключена:

```json
"allow_create_new_accounts": false
```

Поэтому из коробки страница `/register/` не подойдет для первого входа.

Для первичного развёртывания проще всего сделать так:

1. временно поставьте `allow_create_new_accounts` в `true` в `config/app.redis.json`;
2. поднимите сервисы;
3. откройте `/register/`;
4. зарегистрируйте первую компанию;
5. первый зарегистрированный пользователь автоматически станет администратором;
6. верните `allow_create_new_accounts` в `false`;
7. перезапустите контейнер приложения:

```bash
docker compose restart app
```

Если у вас уже есть корпоративный SSO и вы хотите полностью избежать публичной регистрации, можно оставить `false` и заводить пользователей только через заранее подготовленную схему администрирования или auto-provisioning.

## Обычный запуск

### 1. Соберите и поднимите контейнеры

```bash
docker compose up --build -d
```

### 2. Примените миграции

```bash
docker compose run --rm app npm run db-update
```

### 3. Откройте приложение

По умолчанию:

```text
http://localhost:3000
```

Если в `.env` вы поменяли `APP_PORT`, используйте свой порт.

## Что можно менять в `.env`

### База данных

- `DB_DIALECT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_LOGGING`

### Настройки MySQL-контейнера

- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

### Секреты приложения

- `SESSION_SECRET`
- `CRYPTO_SECRET`

### Параметры cookie и reverse proxy

- `TRUST_PROXY`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_MAX_AGE_MS`

### Прочее

- `APP_PORT`
- `RUN_DB_MIGRATIONS`

## Когда включать `RUN_DB_MIGRATIONS=true`

По умолчанию в compose стоит:

```text
RUN_DB_MIGRATIONS=false
```

Это безопаснее для контролируемых выкладок.

Если хотите, чтобы контейнер приложения сам запускал миграции при старте, можно поставить:

```text
RUN_DB_MIGRATIONS=true
```

Но для рабочей корпоративной среды обычно лучше запускать миграции явно отдельной командой:

```bash
docker compose run --rm app npm run db-update
```

## Как проверить, что всё поднялось

### Статус контейнеров

```bash
docker compose ps
```

Ожидаемо:

- `db` — healthy
- `redis` — healthy
- `app` — running или healthy

### Логи приложения

```bash
docker compose logs app
```

### Логи MySQL

```bash
docker compose logs db
```

### Логи Redis

```bash
docker compose logs redis
```

## Как проверить MySQL

### Проверка из MySQL-контейнера

```bash
docker compose exec db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"
```

### Проверка из приложения

```bash
docker compose exec app node -e "const db=require('./lib/model/db'); console.log({dialect: db.sequelize.getDialect(), host: db.sequelize.config.host, database: db.sequelize.config.database}); db.sequelize.close();"
```

Ожидаемо:

- `dialect: 'mysql'`
- `host: 'db'`

## Как проверить Redis

### Базовая проверка

```bash
docker compose exec redis redis-cli ping
```

Ответ должен быть:

```text
PONG
```

### Проверка сессий

1. Войдите в приложение через браузер.
2. Выполните:

```bash
docker compose exec redis redis-cli KEYS 'sess:*'
```

Если ключи есть, сессии пишутся в Redis.

## Корпоративный запуск за reverse proxy

Если приложение публикуется не напрямую, а через `nginx`, `traefik` или `caddy`, обычно ставят:

```text
TRUST_PROXY=1
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=lax
```

Также в `config/app.redis.json` нужно выставить корректный внешний адрес:

```json
"application_domain": "https://timeoff.example.com"
```

Если внешний URL и `application_domain` не совпадают, часто ломаются:

- SSO callback;
- корректная выдача secure-cookie;
- редиректы.

## Docker Compose для разработки

Если нужна разработка в контейнере с примонтированным проектом:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Этот вариант:

- использует dev-target образа;
- монтирует код внутрь контейнера;
- пересобирает CSS;
- запускает приложение в `watch`-режиме.

## Как остановить и удалить окружение

### Просто остановить

```bash
docker compose down
```

### Остановить и удалить тома

```bash
docker compose down -v
```

Это удалит данные MySQL и Redis внутри docker volumes.

Используйте `-v` только если готовы потерять данные контейнеров.
