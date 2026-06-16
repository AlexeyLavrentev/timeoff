# Community and Commercial Builds

This project now has two delivery modes:

- Community build: open-source core only.
- Commercial build: open-source core plus a private premium module.

Use `docs/release-checklist.md` before publishing either build.

## Repositories

Core application:

```text
/Users/aleksey/timeoff
```

Private premium module:

```text
/Users/aleksey/timeoff-premium
```

The community repository must not contain premium implementation files. Premium
routes, models, migrations, views, email templates, translations, and helpers
live in the private module.

## Community Image

Build and run the regular community image:

```sh
docker compose up --build
```

In this mode:

- `TIMEOFF_PREMIUM_MODULE` is empty.
- Premium DB models are not loaded.
- Premium routes are not registered.
- Premium migrations are not applied.
- Premium navigation items are hidden.

## Commercial Image With Docker COPY

The commercial Docker target copies the private premium module into the image
through a BuildKit named context.

Build and run:

```sh
TIMEOFF_PREMIUM_MODULE_HOST_PATH=/Users/aleksey/timeoff-premium \
TIMEOFF_LICENSE=PASTE_BASE64_LICENSE_HERE \
TIMEOFF_LICENSE_PUBLIC_KEY=PASTE_PUBLIC_KEY_WITH_ESCAPED_NEWLINES_HERE \
docker compose -f docker-compose.yml -f docker-compose.commercial.yml up --build
```

The commercial override:

- builds Docker target `commercial`;
- copies the premium module to `/opt/timeoff-premium`;
- sets `TIMEOFF_PREMIUM_MODULE=/opt/timeoff-premium`;
- requires `TIMEOFF_LICENSE`;
- requires `TIMEOFF_LICENSE_PUBLIC_KEY`.

Use this mode for production-like self-hosted commercial delivery.

## Local Premium Development

For local development, mount the premium repository instead of copying it into
the image:

```sh
TIMEOFF_PREMIUM_MODULE_HOST_PATH=/Users/aleksey/timeoff-premium \
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.premium-dev.yml up --build
```

The premium dev override:

- mounts the premium repo at `/opt/timeoff-premium`;
- sets `TIMEOFF_PREMIUM_MODULE=/opt/timeoff-premium`;
- enables `FEATURE_TIME_BALANCE=true`;
- enables `FEATURE_VACATION_PLANNING=true`.

Do not use `FEATURE_*` as the normal production path. Production should use a
signed license.

## RSA License

Generate keys outside customer deployments:

```sh
openssl genrsa -out license_private.pem 3072
openssl rsa -in license_private.pem -pubout -out license_public.pem
```

Generate a base64 license:

```sh
node bin/sign_license.js \
  --customer "Example Ltd" \
  --features time_balance,vacation_planning \
  --expires 2027-12-31T23:59:59.000Z \
  --private-key-file license_private.pem \
  --base64
```

Set the output as `TIMEOFF_LICENSE`. Set the public key as
`TIMEOFF_LICENSE_PUBLIC_KEY`. If the public key is stored in an environment
variable, escape newlines as `\n`.

## Verification

Core checks:

```sh
./node_modules/.bin/mocha \
  t/unit/edition_premium_loader.js \
  t/unit/edition_community_boundary.js \
  t/unit/edition_registry.js \
  t/unit/features.js \
  t/unit/email_template_paths.js \
  t/unit/partial_template_paths.js
```

Premium checks:

```sh
cd /Users/aleksey/timeoff-premium
npm run check
npm test
```

External module smoke test:

```sh
TIMEOFF_PREMIUM_MODULE=/Users/aleksey/timeoff-premium \
FEATURE_TIME_BALANCE=true \
FEATURE_VACATION_PLANNING=true \
node -e "const app=require('./app'); const db=app.get('db_model'); const edition=require('./lib/edition'); const i18next=require('./lib/i18n').i18next; console.log(Boolean(db.TimeBalanceEntry)+','+Boolean(db.VacationPlan)+','+edition.getInfo().routes.length+','+i18next.t('nav.timeBalance')); process.exit(0);"
```

Expected output:

```text
true,true,2,Time balance
```
