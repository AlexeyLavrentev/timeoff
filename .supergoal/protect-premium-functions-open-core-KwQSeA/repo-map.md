# Repo map

_Generated 2026-06-14 13:20:37_

## Top-level layout
- Dockerfile
- LICENSE
- README.md
- app.js
- bin
- config
- db.development.sqlite
- db.test.sqlite
- docker
- docker-compose.dev.yml
- docker-compose.yml
- docs
- lib
- locales
- migrations
- node_modules
- package-lock.json
- package.json
- public
- scss
- t
- views

## Source directories (depth 2)
### `lib/`
- lib/middleware
- lib/cache
- lib/route
- lib/route/validator
- lib/route/utils
- lib/route/users
- lib/route/api
- lib/util
- lib/auth
- lib/edition
- lib/scheduler
- lib/passport
- lib/sso
- lib/model
- lib/model/mixin
- lib/model/db
- lib/model/leave
- lib/model/company
- lib/view
- lib/error

## File counts (top extensions)
- `.js`: 229 files
- `.hbs`: 93 files
- `.json`: 11 files
- `.md`: 10 files
- `.png`: 7 files
- `.yml`: 4 files
- `.css`: 4 files
- `.txt`: 2 files
- `.sh`: 2 files
- `.woff2`: 1 files

## Largest source files (top 15 by line count)
- `public/js/bootstrap-datepicker.js` (1918 lines)
- `scss/main.scss` (1530 lines)
- `public/css/style.css` (1429 lines)
- `lib/route/users/index.js` (1110 lines)
- `lib/sso/index.js` (1068 lines)
- `t/integration/schedule/user_specific.js` (900 lines)
- `public/css/bootstrap-datepicker3.standalone.css` (822 lines)
- `t/integration/department/one_by_one_crud.js` (806 lines)
- `lib/model/mixin/user/absence_aware.js` (750 lines)
- `lib/route/settings.js` (700 lines)
- `lib/model/db/user.js` (675 lines)
- `lib/route/login.js` (616 lines)
- `lib/route/calendar.js` (579 lines)
- `lib/email.js` (558 lines)
- `t/integration/leave_type/colouring_on_calendar.js` (553 lines)

## Test surface
- Test files (by name pattern): 1

## Notable config / infra
- `Dockerfile`
- `docker-compose.dev.yml`
- `docker-compose.yml`

## Recent activity (last 10 commits)
- `a6104fb` 2026-06-14 Добавляю слой редакций
- `34fc57b` 2026-06-14 Исправляю вход без SSO
- `02f9bee` 2026-06-14 Централизую брендинг
- `5b0d20c` 2026-06-14 Закрываю обходы платных функций
- `313a23b` 2026-06-13 Добавляю генератор лицензий
- `a5eeb4b` 2026-06-13 Добавляю подпись лицензий
- `6bdff7a` 2026-06-13 Укрепляю проверку лицензий
- `372713e` 2026-06-13 Добавляю флаги функций и брендинг
- `8d438f8` 2026-06-13 Стабилизирую браузерные тесты
- `f385d74` 2026-06-13 Обновляю тестовый запуск для Node 22

## Files churned in last 20 commits (top 10)
- `package.json` (6×)
- `lib/route/users/index.js` (6×)
- `package-lock.json` (5×)
- `lib/route/login.js` (5×)
- `lib/route/departments.js` (4×)
- `lib/route/bankHolidays.js` (4×)
- `docs/features-branding.md` (4×)
- `lib/sso/index.js` (3×)
- `lib/route/settings.js` (3×)
- `lib/route/groups.js` (3×)

_End repo map._
