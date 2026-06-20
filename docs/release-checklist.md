# Release Checklist

Use this checklist before publishing a LeavePilot Community or Premium build.

## 1. Confirm Repository State

Core repository:

```sh
cd /Users/aleksey/projects/timeoff
git status --short
git log --oneline -5
```

Premium repository:

```sh
cd /Users/aleksey/projects/timeoff-premium
git status --short
git log --oneline -5
```

Expected:

- no uncommitted release changes;
- no `.env`, key, license, database dump, or customer data staged;
- core and premium CI are green on GitHub.

## 2. Run Local Checks

Core:

```sh
cd /Users/aleksey/projects/timeoff

./node_modules/.bin/mocha \
  t/unit/edition_premium_loader.js \
  t/unit/edition_community_boundary.js \
  t/unit/edition_registry.js \
  t/unit/features.js \
  t/unit/email_template_paths.js \
  t/unit/partial_template_paths.js
```

Premium:

```sh
cd /Users/aleksey/projects/timeoff-premium
npm run check
npm test
```

Compose configuration:

```sh
cd /Users/aleksey/projects/timeoff

SESSION_SECRET=ci-session-secret \
CRYPTO_SECRET=ci-crypto-secret \
docker compose config --quiet

SESSION_SECRET=ci-session-secret \
CRYPTO_SECRET=ci-crypto-secret \
TIMEOFF_PREMIUM_MODULE_HOST_PATH=/Users/aleksey/projects/timeoff-premium \
TIMEOFF_LICENSE=ci-license-placeholder \
TIMEOFF_LICENSE_PUBLIC_KEY=ci-public-key-placeholder \
docker compose -f docker-compose.yml -f docker-compose.commercial.yml config --quiet
```

## 3. Community Build

Community build contains only the open-source core.

```sh
cd /Users/aleksey/projects/timeoff
docker compose build app
```

Community runtime expectations:

- `TIMEOFF_PREMIUM_MODULE` is empty;
- premium DB models are absent;
- premium routes are absent;
- premium migrations are not applied.

Quick community boundary check:

```sh
./node_modules/.bin/mocha t/unit/edition_community_boundary.js
```

## 4. Commercial Build

Commercial build copies the private premium module into the Docker image.

Required inputs:

- private premium repo path;
- signed RSA license;
- public license key;
- production secrets.

Build and start:

```sh
TIMEOFF_PREMIUM_MODULE_HOST_PATH=/Users/aleksey/projects/timeoff-premium \
TIMEOFF_LICENSE=PASTE_BASE64_LICENSE_HERE \
TIMEOFF_LICENSE_PUBLIC_KEY=PASTE_PUBLIC_KEY_WITH_ESCAPED_NEWLINES_HERE \
docker compose -f docker-compose.yml -f docker-compose.commercial.yml up --build -d
```

Commercial runtime expectations:

- premium module is copied to `/opt/timeoff-premium`;
- `TIMEOFF_PREMIUM_MODULE=/opt/timeoff-premium`;
- `TIMEOFF_PREMIUM_MODULE_REQUIRED=true`;
- signed license is valid;
- premium migrations run during `npm run db-update`.

## 5. License Issue Flow

Generate an RSA key pair outside customer deployments:

```sh
openssl genrsa -out license_private.pem 3072
openssl rsa -in license_private.pem -pubout -out license_public.pem
```

Generate a customer license:

```sh
node bin/sign_license.js \
  --customer "Customer Name" \
  --features sso_authentication,integration_api,employee_groups,work_calendars,leave_start_reminders,time_balance,vacation_planning \
  --expires 2027-12-31T23:59:59.000Z \
  --private-key-file license_private.pem \
  --base64
```

Never commit:

- `license_private.pem`;
- generated customer licenses;
- customer-specific `.env` files.

Customer deployment receives:

- `TIMEOFF_LICENSE`;
- `TIMEOFF_LICENSE_PUBLIC_KEY`;
- commercial image or premium package access.

## 6. Migration Check

Before serving traffic, run:

```sh
npm run db-update
```

For Docker Compose deployments this can be automatic through
`RUN_DB_MIGRATIONS=true`, but controlled production releases should prefer a
separate migration step.

Expected commercial migration output includes premium migrations:

```text
20260521123000-create-time-balance-entries.js
20260602120000-add-vacation-plans-and-time-balance-details.js
20260602130000-link-vacation-plans-to-leaves.js
```

## 7. Smoke Tests

External module smoke:

```sh
TIMEOFF_PREMIUM_MODULE=/Users/aleksey/projects/timeoff-premium \
FEATURE_TIME_BALANCE=true \
FEATURE_VACATION_PLANNING=true \
node -e "const app=require('./app'); const db=app.get('db_model'); const edition=require('./lib/edition'); const i18next=require('./lib/i18n').i18next; console.log(Boolean(db.TimeBalanceEntry)+','+Boolean(db.VacationPlan)+','+edition.getInfo().routes.length+','+i18next.t('nav.timeBalance')); process.exit(0);"
```

Expected:

```text
true,true,2,Time balance
```

Docker HTTP smoke:

```sh
curl -I http://127.0.0.1:${APP_PORT:-3000}/
```

Expected:

- HTTP `302` to `./login/`, or another non-error application response;
- app logs do not contain startup errors;
- `db`, `redis`, and `app` containers are healthy.

## 8. Version Compatibility

Premium compatibility metadata is stored in:

```text
/Users/aleksey/projects/timeoff-premium/package.json
```

The `timeoffCore` field records:

- premium module contract version;
- core ref used by premium CI;
- required core extension points.

Before a commercial release:

1. Confirm premium CI uses the intended core ref.
2. After merging core, update premium `testedWithRef` from a feature branch to
   the release branch or tag.
3. Tag core and premium together when the pair is released.

Release tags:

```sh
git tag v1.0.1
git tag v0.1.1
```

## 9. Rollback

Rollback options:

- redeploy the previous core image;
- redeploy the previous commercial image;
- disable a specific premium feature with explicit `FEATURE_NAME=false`;
- restore a database backup if a migration must be rolled back.

Do not rely on destructive manual DB edits as the first rollback path.

For commercial deployments, keep:

- previous image tag;
- previous premium module commit/tag;
- database backup before migrations;
- previous customer license if license scope changed.

## 10. Final Release Gate

Release only when all are true:

- core CI is green;
- premium CI is green;
- local focused checks pass;
- commercial Docker smoke passes;
- RSA license has been generated for the intended customer;
- no secrets are committed;
- release notes mention whether migrations are included;
- rollback image/tag and DB backup exist.
