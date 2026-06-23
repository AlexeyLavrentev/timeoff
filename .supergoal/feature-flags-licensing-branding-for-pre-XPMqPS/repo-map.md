# Repo map

## Top-level layout

- `app.js`
- `bin/`
- `config/`
- `lib/`
- `locales/`
- `migrations/`
- `public/`
- `scss/`
- `t/`
- `views/`

## Feature-looking areas from current tree/history

- Annual/vacation planning: `lib/route/vacation_plans.js`, `views/vacation_plans.hbs`, `views/partials/vacation_plan_*`, `lib/cache/vacation_plan_cache.js`, `lib/model/vacation_plan*`.
- Time balance: `lib/route/time_balance*`, `views/time_balance.hbs`, time-balance email templates.
- Audit: `lib/route/audit*`, `views/audit/emails.hbs`.
- Reports: `lib/route/reports*`, `views/report/*`.
- SSO/LDAP/OIDC/SAML: `lib/sso`, `lib/auth`, `lib/passport`, settings authentication views.
- Integration API: `lib/route/integration_api`, `lib/route/api`, settings integration API view.
- Theme/localization/UI refresh: `views/layouts/main.hbs`, `views/partials/header.hbs`, `scss/main.scss`, locales.

## Verification surface

- Tests live under `t/`, though repository summarizer did not detect name-pattern test files.
- Mandatory baseline command is `npm test`.
- CSS compilation command is `npm run build-css`.
