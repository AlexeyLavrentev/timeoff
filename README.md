# TimeOff.Management

Веб‑приложение для управления отсутствиями сотрудников.

<a href="https://travis-ci.org/timeoff-management/timeoff-management-application"><img align="right" src="https://travis-ci.org/timeoff-management/timeoff-management-application.svg?branch=master" alt="Build status" /></a>

## Возможности

**Несколько представлений отсутствий**

Календарный вид, обзор команды или простой список.

**Гибкая настройка под политику компании**

Добавляйте собственные типы отсутствий: больничный, декрет, удалённая работа, день рождения и т.д. Определяйте, влияет ли тип на отпускной баланс.

Опционально ограничивайте количество дней, доступных для каждого типа отсутствия (например, не более 10 больничных в год).

Настраивайте государственные и корпоративные выходные.

Группируйте сотрудников по отделам, задавайте руководителя для каждого отдела.

Поддерживается индивидуальный рабочий график для компании и сотрудников.

**Интеграция с календарями**

Публикация отсутствий в MS Outlook, Google Calendar и iCal.

Создавайте фиды для сотрудников, отделов или всей компании.

**Трёхшаговый процесс согласования**

Сотрудник запрашивает отпуск или отзывает его.

Руководитель получает уведомление по почте и принимает решение.

Отсутствие учитывается, коллеги видят его в командном обзоре и календарях.

**Контроль доступа**

Есть роли: сотрудник, руководитель, администратор.

Поддерживается LDAP‑аутентификация.

**Экспорт данных**

Возможность выгрузки данных по отпускам в CSV для резервного копирования и работы в табличных редакторах.

**Работа на мобильных устройствах**

Основные сценарии оптимизированы для мобильных:

* запрос нового отпуска;
* согласование отпуска руководителем.

**Дополнительные улучшения**

* Интернационализация интерфейса (EN/RU) через i18next и шаблоны Handlebars.
* Группы пользователей с CRUD‑управлением и фильтрами в интерфейсе.
* Ограничение пересечения отпусков критически важных сотрудников по отделу.

## Скриншоты

![TimeOff.Management Screenshot](https://raw.githubusercontent.com/timeoff-management/application/master/public/img/readme_screenshot.png)

## Установка

### Облачный хостинг

Перейдите на http://timeoff.management/

Создайте аккаунт компании и используйте облачную версию.

### Самостоятельный хостинг

Убедитесь, что установлены Node.js 20 LTS или новее и SQLite.

Для локальной среды в репозитории зафиксирована версия Node `20` через
`.nvmrc` и `.node-version`.

По умолчанию self-signup в self-hosted/corporate конфигурации отключён:
новые пользователи должны создаваться через администратора, импорт или
SSO auto-provisioning. Если публичная регистрация действительно нужна,
включите `allow_create_new_accounts` явно в `config/app.json` для своего
окружения.

```bash
git clone https://github.com/timeoff-management/application.git timeoff-management
cd timeoff-management
npm install
npm start
```

Откройте http://localhost:3000/ в браузере.

## Работа через Docker

### Сборка образа

```bash
docker build -t timeoff:local .
```

### Запуск контейнера

```bash
docker run --rm -p 3000:3000 timeoff:local
```

После запуска приложение будет доступно на http://localhost:3000/.

### Docker Compose для MySQL (production)

Для продакшен‑сценариев используйте MySQL и `docker-compose.yml`, который поднимает базу и приложение вместе.

```bash
docker compose up --build
```

После запуска:

* Приложение: http://localhost:3000/
* MySQL: `db:3306` внутри сети compose

Инициализацию/миграции можно запустить вручную:

```bash
docker compose run --rm app npm run db-update
```

Переменные подключения к базе можно переопределить через окружение:

* `DB_DIALECT`, `DB_HOST`, `DB_PORT`
* `DB_NAME`, `DB_USER`, `DB_PASSWORD`
* `DB_STORAGE`, `DB_LOGGING`
* также поддерживаются `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`

Чтобы убрать подробные SQL‑логи Sequelize, установите `DB_LOGGING=false`
в окружении (уже задано в `docker-compose.yml`).

Compose автоматически читает `.env`, поэтому секреты и локальные значения
лучше выносить туда, а не редактировать `docker-compose.yml`.

Для секретов приложения это обязательно:

* `SESSION_SECRET` отвечает за подпись сессий Express
* `CRYPTO_SECRET` используется для внутреннего хеширования паролей и reset-token flow

В `production` и `staging` приложение не стартует без этих переменных.
В репозитории они больше не хранятся в `config/app.json` и `config/app.redis.json`.

Для reverse proxy и cookie hardening используются отдельные env-флаги:

* `TRUST_PROXY=1` включает proxy-aware режим Express за nginx/traefik
* `SESSION_COOKIE_SECURE=true` включает выдачу cookie только по HTTPS
* `SESSION_COOKIE_SAME_SITE=lax` задаёт базовую CSRF-устойчивую политику cookie
* `SESSION_COOKIE_MAX_AGE_MS=43200000` задаёт TTL cookie в миллисекундах

Для локальной HTTP-разработки оставляйте `TRUST_PROXY=0` и
`SESSION_COOKIE_SECURE=false`. Для корпоративного HTTPS-развёртывания за
reverse proxy переключайте `TRUST_PROXY=1` и `SESSION_COOKIE_SECURE=true`.

#### Диагностика ошибки доступа к MySQL

Если при запуске в контейнере появляется ошибка вида:

```
SequelizeAccessDeniedError: ER_ACCESS_DENIED_ERROR: Access denied for user
```

то чаще всего уже существует том MySQL, созданный с другими учётными данными.
В таком случае удалите том и пересоздайте контейнеры:

```bash
docker compose down -v
docker compose up --build
```

Либо убедитесь, что значения `MYSQL_USER`/`MYSQL_PASSWORD` в `docker-compose.yml`
совпадают с `DB_USER`/`DB_PASSWORD` для приложения.

Если появляется ошибка `ER_NO_SUCH_TABLE: Table 'timeoff.Sessions' doesn't exist`,
убедитесь, что таблицы созданы:

```bash
docker compose run --rm app npm run db-update
```

#### Docker Compose с Redis для хранения сессий

В `docker-compose.yml` уже добавлен контейнер Redis и подключена конфигурация
`config/app.redis.json`, чтобы сессии хранились в Redis.

Для запуска:

```bash
docker compose up --build
```

Redis будет доступен внутри сети compose по хосту `redis:6379`.
Перед первым запуском скопируйте `.env.example` в `.env` и задайте
свои значения `SESSION_SECRET` и `CRYPTO_SECRET`.

### Docker Compose для разработки

Для разработки используйте override-файл:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Он использует dev-target образа, монтирует проект в контейнер и сохраняет
`node_modules` внутри контейнера, чтобы локальные зависимости хоста не
перетирали Linux-сборку модулей.

## Deployment Profile: corporate-local

Профиль `corporate-local` предназначен не для демонстрации приложения на
`localhost`, а для локального корпоративного развёртывания как внутреннего
сервиса за reverse proxy с HTTPS, Redis-сессиями и централизованной
аутентификацией.

Минимальные требования профиля:

* self-signup отключён
* секреты задаются только через `.env` или secret store
* внешний доступ идёт только через HTTPS/reverse proxy
* сессии хранятся в Redis
* схема БД обновляется только через миграции
* SSO/LDAP включаются только после базового hardening

### corporate-local: шаги запуска

1. Скопируйте `.env.example` в `.env` и задайте собственные значения
   `SESSION_SECRET`, `CRYPTO_SECRET`, `MYSQL_PASSWORD`,
   `MYSQL_ROOT_PASSWORD`.
2. Для HTTPS-контура выставьте:
   `TRUST_PROXY=1`, `SESSION_COOKIE_SECURE=true`,
   `SESSION_COOKIE_SAME_SITE=lax`.
3. Оставьте self-signup выключенным. Compose-профиль уже использует
   `config/app.redis.json` с `allow_create_new_accounts=false`, поэтому
   новые пользователи должны появляться только через администратора,
   импорт или SSO auto-provisioning.
4. Укажите внешний адрес приложения в `config/app.redis.json` через
   `application_domain`, чтобы он совпадал с реальным HTTPS URL за proxy.
5. Поднимите инфраструктуру:

```bash
docker compose up --build -d
```

6. Обязательно примените миграции после первого старта и перед каждым
   обновлением:

```bash
docker compose run --rm app npm run db-update
```

7. Только после этого включайте корпоративную аутентификацию:
   LDAP или SSO (`OIDC`/`SAML`) на уровне конкретной компании.

### corporate-local: reverse proxy

Рекомендуемая схема:

* внешний TLS завершается на nginx/traefik/caddy
* proxy передаёт приложению `X-Forwarded-Proto=https`
* наружу публикуется только proxy, а не контейнер приложения напрямую
* callback URL для SSO должны смотреть на внешний HTTPS-домен

Если proxy не выставляет корректный forwarded protocol, secure-cookie и
SSO callback flow будут работать некорректно.

### corporate-local: post-deploy checks

После выката проверьте:

1. `docker compose ps` показывает `app`, `db`, `redis` в healthy/running состоянии.
2. `docker compose run --rm app npm run db-update` завершается без ошибок.
3. В UI отсутствует self-signup flow, а прямой переход на `/register`
   блокируется.
4. Session cookie приходит с `HttpOnly`, `SameSite=Lax`, а в HTTPS-контуре
   ещё и с `Secure`.
5. Вход через локальный пароль, LDAP или SSO работает только для тех
   режимов, которые явно включены для компании.
6. Redis используется как session store, а после перезапуска `app`
   активные сессии не теряются преждевременно.
7. Если включён SSO, callback URL и redirect flow совпадают с внешним
   `application_domain`.

### corporate-local: что не использовать

Для этого профиля не полагайтесь на:

* дефолтный HTTP `localhost` URL как production-like адрес
* хранение секретов в `config/*.json`
* публичную регистрацию пользователей
* runtime-изменение схемы вместо `npm run db-update`

## Запуск тестов

Тесты покрывают основные пользовательские сценарии.

Убедитесь, что в системе установлен Chrome Driver и браузер Chrome.

Чтобы увидеть выполнение сценариев в браузере, задайте `SHOW_CHROME=1`.

```bash
USE_CHROME=1 npm test
```

(Приложение с настройками по умолчанию должно быть запущено.)

## Обновление существующей инсталляции

Если нужно обновить текущую установку новой версией:

```bash
git fetch
git pull origin master
npm install
npm run-script db-update
npm start
```

Перед обновлением убедитесь, что окружение использует Node.js 20+,
как указано в `package.json`, `.nvmrc`, `.node-version`, Dockerfile и CI.

## SSO: краткий runbook

Подробная инструкция для Keycloak и примеры конфигурации находятся в
[`docs/sso-keycloak.md`](/home/sdigitaladmin/timeoff/docs/sso-keycloak.md).
Для первичной настройки SSO в большинстве случаев достаточно этого checklist:

1. Проверьте `application_domain` в `config/app.json`: это должен быть внешний HTTPS URL приложения, который видят пользователи и IdP.
2. Примените миграции перед настройкой SSO: `npm run db-update`.
3. Откройте `Settings -> Authentication -> SSO` и настройте SSO для нужной компании, выбрав один активный метод: `OIDC` или `SAML 2.0`.
4. Укажите корректный callback URL в провайдере идентификации:
   `OIDC callback` -> `/login/sso/callback`
   `SAML ACS` -> `/login/sso/callback/saml`

Если приложение развернуто за reverse proxy, внешний URL и callback URL у IdP
должны совпадать с тем, что реально открывает пользователь в браузере.

То же правило относится и к session cookie: для HTTPS-контура за nginx/traefik
включайте `TRUST_PROXY=1`, иначе Express не будет корректно учитывать
проксированный протокол и secure-cookie режим.

### Release runbook: обязательные миграции

Для каждого релиза миграции базы данных считаются обязательным шагом выката.
Это особенно важно для SSO-функциональности, которая зависит от миграции
`migrations/20260322120000-add-sso-auth-to-company.js`.

Минимальная последовательность:

```bash
git fetch
git pull origin master
npm install
npm run db-update
npm start
```

`npm run db-update` нельзя пропускать даже если приложение уже собрано или
контейнер обновлен: новая версия кода может ожидать поля, которых еще нет в схеме.

Post-check после релиза:

1. В выводе `npm run db-update` должно быть либо `Applied migrations: none`,
   либо список примененных миграций без ошибок.
2. В таблице `SequelizeMeta` должна присутствовать запись
   `20260322120000-add-sso-auth-to-company.js`.
3. В таблице `Companies` должны существовать колонки
   `sso_auth_enabled`, `sso_auth_provider`, `sso_auth_config`.

Примеры ручной проверки схемы:

Для SQLite:

```bash
sqlite3 db.development.sqlite "SELECT name FROM SequelizeMeta WHERE name = '20260322120000-add-sso-auth-to-company.js';"
sqlite3 db.development.sqlite "PRAGMA table_info('Companies');"
```

Для MySQL:

```bash
mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT name FROM SequelizeMeta WHERE name = '20260322120000-add-sso-auth-to-company.js';"
mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW COLUMNS FROM Companies LIKE 'sso_auth_%';"
```

## Как настроить?

Есть несколько параметров для кастомизации.

### Язык интерфейса

По умолчанию используется язык из `config/app.json`:

* `default_language` — язык по умолчанию для интерфейса и писем (например, `en` или `ru`).
* `supported_languages` — список доступных языков (например, `["en", "ru"]`).

В интерфейсе доступен переключатель языка в правой части верхней панели. Он сохраняет выбор в cookie.

### Добавление нового языка

1. Создайте новый каталог перевода: `public/locales/<код_языка>/translation.json`.
2. Скопируйте структуру ключей из `public/locales/en/translation.json` и переведите значения.
3. Добавьте код языка в `supported_languages` и при необходимости укажите `default_language` в `config/app.json`.
4. Перезапустите приложение.

### SSO через Keycloak

Подробная инструкция по настройке единого входа через Keycloak для обоих поддерживаемых режимов лежит в [docs/sso-keycloak.md](docs/sso-keycloak.md).

Важно: приложение поддерживает только один активный SSO-метод на компанию одновременно: либо `OIDC`, либо `SAML 2.0`.

### Локализация сортировки

Если в компании есть сотрудники с именами на разных языках, может быть важно сортировать по соответствующему алфавиту.

Для этого в `config/app.json` есть параметр `locale_code_for_sorting`.
По умолчанию значение `en` (английский), но можно указать `cs`, `fr`, `de` и т.д.

### Принудительный выбор типа отпуска

Некоторые организации требуют, чтобы сотрудник каждый раз выбирал тип отсутствия при создании заявки, чтобы избежать «ошибочных» отпусков.

Для этого установите `is_force_to_explicitly_select_type_when_requesting_new_leave` в `true` в файле `config/app.json`.

## Использование Redis для сессий

Следуйте инструкциям на [этой странице](docs/SessionStoreInRedis.md).

## Обратная связь

Сообщайте об ошибках или оставляйте отзывы через <a href="https://twitter.com/FreeTimeOffApp">twitter</a> или по email: pavlo at timeoff.management
