# TimeOff.Management

Веб-приложение для управления отпусками, больничными, отгулами и другими отсутствиями сотрудников.

Проект можно:

- быстро поднять локально для знакомства и тестирования;
- запустить как внутренний сервис компании;
- развернуть с `MySQL` и `Redis` через `docker compose`;
- подключить к корпоративной аутентификации через LDAP/SSO.

## Что умеет приложение

- календарный и табличный просмотр отсутствий;
- роли сотрудника, руководителя и администратора;
- согласование отпусков;
- разные типы отсутствий;
- экспорт в CSV;
- интеграция с календарями;
- локализация интерфейса;
- LDAP и SSO (`OIDC`/`SAML`).

## Какой способ установки выбрать

| Сценарий | Рекомендуемый способ |
|---|---|
| Просто посмотреть и протестировать приложение на одном ПК | `npm` + `SQLite` |
| Разработка без Docker | `npm` + `SQLite` или внешний `MySQL` |
| Корпоративный пилот / внутренний сервер | `docker compose` |
| Нужны `MySQL` и `Redis` "из коробки" | `docker compose` |

Если нужна самая простая установка для обычного пользователя, начинайте с `npm` + `SQLite`.

Если нужна конфигурация, похожая на рабочую корпоративную среду, используйте `docker compose`.

## Что понадобится заранее

### Для установки через npm

- `Node.js 20` или новее
- `npm`

### Для установки через Docker

- `Docker`
- `Docker Compose` plugin (`docker compose`)

## Что нужно проверить и при необходимости отредактировать до первого запуска

### 1. Файл `.env`

Для `docker compose` это обязательный шаг.

Скопируйте шаблон:

```bash
cp .env.example .env
```

Минимум, что нужно заменить:

- `SESSION_SECRET`
- `CRYPTO_SECRET`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

Если нужно, также меняют:

- `APP_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `TRUST_PROXY`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAME_SITE`

### 2. Файл `config/app.json`

Нужно редактировать, если вы запускаете приложение напрямую через `npm`.

Чаще всего меняют:

- `application_domain` — адрес приложения, который видят пользователи;
- `default_language` и `supported_languages`;
- `allow_create_new_accounts` — разрешать ли самостоятельную регистрацию;
- `send_emails` и `email_transporter` — если хотите реальные почтовые уведомления;
- `sessionStore.useRedis` и `sessionStore.redisConnectionConfiguration` — если локальный запуск через `npm` должен использовать `Redis`.

### 3. Файл `config/app.redis.json`

Нужно редактировать, если вы запускаете приложение через `docker compose`.

Именно этот файл монтируется в контейнер как основной `config/app.json`.

Обычно меняют:

- `application_domain`;
- `default_language` и `supported_languages`;
- `send_emails` и `email_transporter`;
- `allow_create_new_accounts` — по умолчанию уже `false`;
- `sessionStore.redisConnectionConfiguration`, если Redis будет не в контейнере `redis`.

## Быстрый старт №1: npm + SQLite

Это самый простой способ попробовать приложение локально.

### Шаг 1. Установите зависимости

```bash
npm install
```

### Шаг 2. Примените миграции

```bash
npm run db-update
```

### Шаг 3. Запустите приложение

```bash
npm start
```

### Шаг 4. Откройте приложение

Откройте в браузере:

```text
http://localhost:3000
```

### Что происходит в этом режиме

- по умолчанию используется `SQLite`;
- база лежит в файле `db.development.sqlite`;
- сессии по умолчанию хранятся в базе, а не в `Redis`;
- секреты для `development` подставляются автоматически, если вы не задали их вручную.

### Как появляется первый администратор

В этом режиме самостоятельная регистрация включена по умолчанию, поэтому:

1. откройте `/register/`;
2. зарегистрируйте компанию;
3. первый пользователь автоматически станет администратором этой компании.

Подробная инструкция: [docs/install-local-npm.md](docs/install-local-npm.md)

## Быстрый старт №2: npm + внешний MySQL и Redis

Этот режим подходит, если Docker не нужен, но вы хотите работать не с `SQLite`, а с реальными сервисами.

### Перед запуском

1. Поднимите свой `MySQL`.
2. Поднимите свой `Redis`.
3. Отредактируйте `config/app.json`:
   - включите `sessionStore.useRedis: true`;
   - пропишите адрес `Redis`.
4. Задайте переменные окружения для БД.

Пример:

```bash
export DB_DIALECT=mysql
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=timeoff
export DB_USER=timeoff
export DB_PASSWORD=strong_password
export SESSION_SECRET=replace-me
export CRYPTO_SECRET=replace-me
```

### Дальше

```bash
npm install
npm run db-update
npm start
```

## Быстрый старт №3: Docker Compose

Это рекомендуемый способ для пилота, внутреннего сервера и "почти production" запуска.

### Шаг 1. Подготовьте `.env`

```bash
cp .env.example .env
```

Замените секреты и пароли.

### Шаг 2. При необходимости отредактируйте `config/app.redis.json`

Обычно заранее меняют:

- `application_domain`;
- email-настройки;
- языки интерфейса;
- политику регистрации пользователей.

### Шаг 3. Поднимите сервисы

```bash
docker compose up --build -d
```

### Шаг 4. Примените миграции

```bash
docker compose run --rm app npm run db-update
```

### Шаг 5. Откройте приложение

```text
http://localhost:3000
```

Или `http://localhost:<APP_PORT>`, если вы меняли порт в `.env`.

### Как создать первого администратора в compose-сценарии

По умолчанию в `config/app.redis.json` стоит:

```json
"allow_create_new_accounts": false
```

Это хорошо для корпоративной эксплуатации, но неудобно для самого первого старта.

Практический вариант для первичной инициализации:

1. временно поставьте в `config/app.redis.json` значение `true`;
2. выполните `docker compose up --build -d`;
3. откройте `/register/` и зарегистрируйте первую компанию;
4. первый пользователь автоматически станет администратором;
5. верните `allow_create_new_accounts` обратно в `false`;
6. перезапустите контейнер приложения:

```bash
docker compose restart app
```

Подробная инструкция: [docs/docker-compose.md](/docs/docker-compose.md)

## Как проверить, что приложение вообще работает

### Быстрая ручная проверка

1. Открывается страница входа.
2. Нет ошибки `500 Internal Server Error`.
3. После входа доступны календарь и настройки.

### Проверка контейнеров

```bash
docker compose ps
```

Ожидаемый результат: `app`, `db`, `redis` находятся в состоянии `running` или `healthy`.

### Проверка HTTP-ответа

```bash
curl -I http://localhost:3000
```

Если приложение отвечает, вы увидите HTTP-статус и заголовки.

## Как проверить, что используется MySQL, а не SQLite

### В Docker Compose

Проверьте диалект и параметры подключения изнутри контейнера приложения:

```bash
docker compose exec app node -e "const db=require('./lib/model/db'); console.log({dialect: db.sequelize.getDialect(), host: db.sequelize.config.host, database: db.sequelize.config.database}); db.sequelize.close();"
```

Ожидаемый результат:

- `dialect: 'mysql'`
- `host: 'db'` или ваш MySQL-хост

Дополнительно можно проверить сам MySQL:

```bash
docker compose exec db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"
```

### В локальном запуске через npm

```bash
node -e "const db=require('./lib/model/db'); console.log({dialect: db.sequelize.getDialect(), host: db.sequelize.config.host, storage: db.sequelize.options.storage}); db.sequelize.close();"
```

Признаки:

- если `dialect` равен `mysql`, приложение работает с `MySQL`;
- если `dialect` равен `sqlite`, приложение работает с `SQLite`;
- у `SQLite` обычно будет `storage: './db.development.sqlite'`.

## Как проверить, что Redis подключен и работает нормально

### Проверка самого Redis

```bash
docker compose exec redis redis-cli ping
```

Ожидаемый ответ:

```text
PONG
```

### Проверка сессий в Redis

1. Войдите в приложение в браузере.
2. Выполните:

```bash
docker compose exec redis redis-cli KEYS 'sess:*'
```

Если ключи появились, сессии пишутся в Redis.

### Проверка из логов приложения

В логах приложения должна появляться строка:

```text
Connected to redis successfully
```

Посмотреть логи:

```bash
docker compose logs app
```

### Важно

При обычном локальном запуске через `npm` Redis по умолчанию не используется, потому что в `config/app.json` стоит:

```json
"useRedis": false
```

Если вам нужен Redis в режиме `npm`, это нужно включить вручную.

## Как протестировать приложение

### 1. Быстрый ручной smoke test

- открыть страницу входа;
- войти под администратором;
- создать сотрудника;
- создать тип отсутствия;
- завести заявку на отпуск;
- убедиться, что календарь и список отображаются.

### 2. Автотесты

```bash
npm test
```

В проекте часть тестов опирается на браузерный стек. Если хотите прогонять сценарии через Chrome, смотрите раздел в:

[docs/verification-and-troubleshooting.md](/docs/verification-and-troubleshooting.md)

## Обновление существующей установки

### Для npm-установки

```bash
git fetch
git pull
npm install
npm run db-update
npm start
```

### Для Docker Compose

```bash
git fetch
git pull
docker compose up --build -d
docker compose run --rm app npm run db-update
```

Миграции пропускать нельзя: новая версия кода может ожидать уже изменённую схему БД.

## Частые вопросы

### Можно ли сначала работать на SQLite, а потом перейти на MySQL?

Да, но это не автоматическая миграция данных. Нужно отдельно переносить данные и отдельно проверять схему.

### Нужно ли редактировать `.env` при запуске через npm?

Нет, не обязательно. Для `development` приложение использует безопасные fallback-секреты. Но для реальной рабочей установки лучше задавать свои значения.

### Какой порт используется?

- локальный `npm start`: `3000`, если не задан `PORT`;
- `docker compose`: контейнер слушает `3000`, наружу публикуется `${APP_PORT:-3000}`.

### Почему через Docker используется `config/app.redis.json`, а не `config/app.json`?

Потому что compose специально монтирует конфиг с включенным Redis-хранилищем сессий.

### Где смотреть инструкции по SSO?

Документ здесь:

[docs/sso-keycloak.md](/docs/sso-keycloak.md)

## Карта документации

- [Локальная установка через npm](/docs/install-local-npm.md)
- [Установка и запуск через Docker Compose](/docs/docker-compose.md)
- [Проверка работы, диагностика и типовые проблемы](/docs/verification-and-troubleshooting.md)
- [FAQ для пользователей и администраторов](/docs/faq.md)
- [Redis как хранилище сессий](/docs/SessionStoreInRedis.md)
- [SSO через Keycloak](/docs/sso-keycloak.md)

## Обратная связь

Если вы нашли ошибку в коде или документации, создайте issue в репозитории или обновите инструкции под свою рабочую схему развёртывания.
