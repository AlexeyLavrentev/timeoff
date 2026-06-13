# Features, Licensing, and Branding

This fork keeps the original leave-management surface available by default and exposes newer modules through feature flags.

## Branding

Default branding lives in `config/app.json`:

```json
"branding": {
  "name": "Leave Management",
  "shortName": "Leave",
  "logoUrl": "",
  "faviconUrl": "/favicon.ico"
}
```

Deployment-specific branding can be supplied through environment variables:

- `BRAND_NAME`
- `BRAND_SHORT_NAME`
- `BRAND_LOGO_URL`
- `BRAND_FAVICON_URL`
- `APPLICATION_DOMAIN`
- `PROMOTION_WEBSITE_DOMAIN`

The app reads these values in `lib/branding.js` and exposes them to templates as `branding`. Email links and the visible product name use the same source.

## Feature Flags

Premium features are defined in `lib/features.js`.

Current feature names:

- `sso_authentication`
- `integration_api`
- `time_balance`
- `vacation_planning`
- `employee_groups`
- `work_calendars`
- `leave_start_reminders`

Enable all features for development or tests:

```sh
TIMEOFF_FEATURES=all npm test
```

Enable selected features:

```sh
TIMEOFF_FEATURES=sso_authentication,integration_api npm start
```

Enable or disable a single feature explicitly:

```sh
FEATURE_TIME_BALANCE=true npm start
FEATURE_VACATION_PLANNING=false npm start
```

`TIMEOFF_FEATURES`, `FEATURE_*`, and `features` in config are treated as unlicensed overrides. They work by default in development and test environments, but production-like environments (`production` and `staging`) ignore them unless `ALLOW_UNLICENSED_FEATURE_OVERRIDES=true` or `allow_unlicensed_feature_overrides` is set explicitly.

Explicit `false` overrides always work as a kill switch, even for licensed features.

`config/app.json` also supports:

```json
"licensed_features": ["time_balance", "vacation_planning"],
"features": {
  "integration_api": true
}
```

## License Payload

`TIMEOFF_LICENSE` may contain JSON or base64-encoded JSON. In development and test environments, an unsigned payload is accepted:

```json
{
  "customer": "Example Ltd",
  "features": ["sso_authentication", "integration_api"]
}
```

In production-like environments (`production` and `staging`), `TIMEOFF_LICENSE` must be signed unless `ALLOW_UNSIGNED_LICENSES=true` or `allow_unsigned_licenses` is set explicitly.

Signed license envelope:

```json
{
  "payload": {
    "customer": "Example Ltd",
    "features": ["sso_authentication", "integration_api"]
  },
  "signature": "hex-encoded-hmac-sha256"
}
```

The signature is HMAC-SHA256 over canonical JSON of `payload`. The signing secret is read from `TIMEOFF_LICENSE_SECRET` or `license_secret`.

Generate a signed license:

```sh
node bin/sign_license.js --customer "Example Ltd" --features sso_authentication,integration_api --secret "$TIMEOFF_LICENSE_SECRET"
```

Add `--base64` when the deployment expects a compact value for `TIMEOFF_LICENSE`.

The rest of the app depends only on `features.isEnabled(name)`, so route and template checks do not need to know where a feature came from.
