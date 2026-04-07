# Проверка работы, диагностика и типовые проблемы

Этот документ нужен, чтобы быстро понять:

- приложение вообще запустилось или нет;
- действительно ли оно работает с `MySQL`, а не с `SQLite`;
- действительно ли используется `Redis`;
- где смотреть ошибки;
- что делать при типовых проблемах.

## Базовая проверка после запуска

## 1. Проверка HTTP

```bash
curl -I http://localhost:3000
```

Если приложение запущено, вы получите HTTP-ответ.

## 2. Проверка страницы входа

Откройте:

```text
http://localhost:3000/login/
```

Если страница открывается без ошибки `500`, приложение уже прошло базовый старт.

## 3. Проверка логов

### Для npm-запуска

Смотрите вывод в том терминале, где вы запускали:

```bash
npm start
```

### Для Docker Compose

```bash
docker compose logs app
docker compose logs db
docker compose logs redis
```

## Как проверить, что используется MySQL, а не SQLite

### Универсальная команда

```bash
node -e "const db=require('./lib/model/db'); console.log({dialect: db.sequelize.getDialect(), host: db.sequelize.config.host, storage: db.sequelize.options.storage, database: db.sequelize.config.database}); db.sequelize.close();"
```

Интерпретация:

- `dialect: 'sqlite'` — работает `SQLite`
- `dialect: 'mysql'` — работает `MySQL`
- `storage: './db.development.sqlite'` — явный признак `SQLite`

### Если приложение в Docker

```bash
docker compose exec app node -e "const db=require('./lib/model/db'); console.log({dialect: db.sequelize.getDialect(), host: db.sequelize.config.host, database: db.sequelize.config.database}); db.sequelize.close();"
```

## Как проверить, что миграции применились

### Через вывод скрипта миграций

```bash
npm run db-update
```

Или в Docker:

```bash
docker compose run --rm app npm run db-update
```

Успешный сценарий:

- либо выводится список применённых миграций;
- либо `Applied migrations: none`.

### Проверка таблицы `SequelizeMeta`

Для MySQL:

```bash
mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT * FROM SequelizeMeta;"
```

Для Docker Compose:

```bash
docker compose exec db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "USE $MYSQL_DATABASE; SELECT * FROM SequelizeMeta;"
```

## Как проверить Redis

## 1. Базовая доступность Redis

```bash
redis-cli ping
```

Или в Docker:

```bash
docker compose exec redis redis-cli ping
```

Ожидаемый ответ:

```text
PONG
```

## 2. Проверка, что сессии пишутся в Redis

1. Откройте приложение и войдите в систему.
2. Выполните:

```bash
redis-cli KEYS 'sess:*'
```

Или:

```bash
docker compose exec redis redis-cli KEYS 'sess:*'
```

Если есть ключи `sess:*`, Redis реально используется для хранения сессий.

## 3. Проверка по логам

В логах приложения ищите:

```text
Connected to redis successfully
```

## Как проверить, что Redis используется не только как сервис, а реально нужен приложению

В проекте Redis используется:

- для хранения сессий, если `sessionStore.useRedis=true`;
- для кэша team view, если рабочий конфиг тоже включает Redis.

Если Redis недоступен, приложение может:

- не сохранить сессию;
- потерять авторизацию после запроса;
- ругаться в логах на ошибки Redis.

## Типовые проблемы и решения

## Проблема: `Missing required environment variables for secrets`

Обычно возникает в `production` или `staging`.

### Что делать

Задайте переменные:

- `SESSION_SECRET`
- `CRYPTO_SECRET`

Для Docker Compose проверьте файл `.env`.

## Проблема: `Access denied for user` при подключении к MySQL

### Причины

- неверный логин или пароль;
- старый Docker volume уже создан с другими учётными данными;
- приложение и MySQL используют разные значения паролей.

### Что делать

1. Проверьте `.env`.
2. Убедитесь, что:
   - `DB_USER` совпадает с `MYSQL_USER`;
   - `DB_PASSWORD` совпадает с `MYSQL_PASSWORD`.
3. Если это тестовый стенд и данные можно удалить:

```bash
docker compose down -v
docker compose up --build -d
```

Потом снова:

```bash
docker compose run --rm app npm run db-update
```

## Проблема: приложение поднялось, но таблиц нет

Признаки:

- ошибки вида `ER_NO_SUCH_TABLE`
- страница открывается с падением при обращении к данным

### Что делать

Запустите миграции:

```bash
npm run db-update
```

Или:

```bash
docker compose run --rm app npm run db-update
```

## Проблема: Redis отвечает `PONG`, но сессии не появляются

### Причины

- Redis доступен, но `useRedis` выключен;
- приложение работает с `config/app.json`, а вы редактировали `config/app.redis.json`;
- вы не вошли в систему, поэтому сессии еще не создались.

### Что проверить

1. В `config/app.json` или `config/app.redis.json` стоит:

```json
"useRedis": true
```

2. После входа в браузере появились ключи:

```bash
redis-cli KEYS 'sess:*'
```

## Проблема: ошибка `Unsupported SESSION_COOKIE_SAME_SITE value`

### Что делать

Допустимы только значения:

- `lax`
- `strict`
- `none`

## Проблема: `SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true`

### Причина

Такой режим запрещён логикой приложения.

### Что делать

Либо:

- поставьте `SESSION_COOKIE_SECURE=true`,

либо:

- верните `SESSION_COOKIE_SAME_SITE=lax`.

## Проблема: приложение за reverse proxy, но логин или cookie работают странно

### Что проверить

- `TRUST_PROXY=1`
- внешний URL совпадает с `application_domain`
- proxy передаёт `X-Forwarded-Proto=https`
- при HTTPS включён `SESSION_COOKIE_SECURE=true`

## Проблема: открыт не тот порт

### Для npm

Порт задаётся переменной:

```text
PORT
```

Если она не указана, используется `3000`.

### Для Docker Compose

Наружный порт задаётся в `.env`:

```text
APP_PORT
```

## Проблема: после перехода с SQLite на MySQL "данные пропали"

Это ожидаемо, если вы просто переключили диалект.

`SQLite` и `MySQL` — это разные хранилища. Переключение не переносит данные автоматически.

## Если приложение не стартует совсем

Проверьте по порядку:

1. `npm install` завершился без ошибок.
2. `npm run db-update` завершился без ошибок.
3. MySQL доступен, если выбран `mysql`.
4. Redis доступен, если он включён в конфиге.
5. Порт `3000` не занят другим приложением.
6. Логи не содержат stack trace при старте.

## Как сделать минимальный post-deploy check для корпоративного пилота

1. `docker compose ps`
2. `docker compose run --rm app npm run db-update`
3. вход в приложение через браузер
4. создание тестового сотрудника
5. создание тестовой заявки на отпуск
6. проверка Redis:

```bash
docker compose exec redis redis-cli KEYS 'sess:*'
```

7. проверка MySQL:

```bash
docker compose exec app node -e "const db=require('./lib/model/db'); console.log(db.sequelize.getDialect()); db.sequelize.close();"
```

Если на всех этапах нет ошибок, базовый запуск можно считать успешным.
