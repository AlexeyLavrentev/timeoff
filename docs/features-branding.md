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

`config/app.json` also supports:

```json
"licensed_features": ["time_balance", "vacation_planning"],
"features": {
  "integration_api": true
}
```

## License Payload

`TIMEOFF_LICENSE` may contain JSON or base64-encoded JSON:

```json
{
  "customer": "Example Ltd",
  "features": ["sso_authentication", "integration_api"]
}
```

The current implementation intentionally keeps license parsing simple. The rest of the app depends only on `features.isEnabled(name)`, so a future signed-license verifier can be added in `lib/features.js` without touching route and template checks.
