# Stack context

Generated 2026-06-12.

## Language and framework

- Node.js application.
- Express 4 server.
- Handlebars via `express-handlebars`.
- Sequelize 6 data layer.
- i18next localization.
- Sass stylesheet compilation.

## Package manager

- npm, with `package-lock.json`.

## Commands

- `npm test` -> `node node_modules/mocha/bin/mocha --recursive t`
- `npm run build-css` -> `npm run compile-sass`
- `npm start` -> `node bin/wwww`

## Important files and modules

- `app.js` wires all public and authenticated routes.
- `lib/config.js` loads `config/app.json` and selected env overrides.
- `lib/view/helpers.js` exposes config-dependent helpers to templates.
- `lib/email.js` renders email templates under `views/email`.
- `views/partials/header.hbs` contains primary navigation.
- `views/layouts/main.hbs` contains page metadata, icons, title, JS boot payload.
- `locales/en.json` and `locales/ru.json` contain visible strings.

## Risky areas

- Routes and navigation currently expose newly added features unconditionally.
- There is no central feature catalog or entitlement check.
- Branding is partly localized (`brand.name`) and partly hardcoded in config/assets.
- Some features appear to be user-added from branch history, but the plan must verify the exact inventory before gating.
