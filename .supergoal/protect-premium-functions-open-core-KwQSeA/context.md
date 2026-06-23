# Stack context

_Generated 2026-06-14 13:20:37_

## Language signals
- **Node/JS/TS** — package.json present
  - Name: `TimeOff.Management`, version: `1.0.0`
  - Top dependencies: @node-saml/node-saml, bluebird, body-parser, chai, chromedriver, connect-redis, connect-session-sequelize, cookie-parser, csv, debug, express, express-handlebars, express-session, formidable, handlebars
  - Framework: **express**

## Package manager
- **npm** (package-lock.json)

## Likely commands
From package.json scripts:
- `test` → `node bin/test.js`
- `start` → `node bin/wwww`
- `start:dev` → `node --watch bin/wwww`
- `db-update` → `node bin/db_update.js`
- `carry-over-allowance` → `node bin/calculate_carry_over_allowance_for_all_users.js`
- `send-upcoming-leave-reminders` → `node bin/send_upcoming_leave_reminders.js`
- `compile-sass` → `sass scss/main.scss public/css/style.css`
- `watch-css` → `sass --watch scss/main.scss:public/css/style.css`
- `build-css` → `npm run compile-sass`

## Git
- Branch: `inf/licensing-open-core`
- Remote: https://github.com/AlexeyLavrentev/timeoff.git
- Working tree: 2 files changed

## Test / lint heuristics
- Has script: `test`
- Has script: `start`

_End stack context._
