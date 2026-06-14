# Premium Module Contract

The community application can optionally load a private premium module at
startup. This keeps the open source core runnable on its own while giving the
commercial build one stable extension point.

## Configuration

Set the module name or path with one of these values:

```env
TIMEOFF_PREMIUM_MODULE=@your-company/timeoff-premium
TIMEOFF_PREMIUM_MODULE_REQUIRED=true
```

or in `config/app.json`:

```json
{
  "premium_module": "@your-company/timeoff-premium",
  "premium_module_required": true
}
```

If the value is empty, the app runs as the community edition. If the configured
module is not installed, the app logs a warning and continues without premium
extensions.

During the current extraction stage, the repository still includes a bundled
premium module for existing `time_balance` and `vacation_planning` code:

```env
TIMEOFF_PREMIUM_MODULE=./lib/edition/bundled_premium
```

Use it together with a license that enables the corresponding features. A future
public community build can omit this file, while a commercial image should point
`TIMEOFF_PREMIUM_MODULE` to a private package instead.

For commercial images, set `TIMEOFF_PREMIUM_MODULE_REQUIRED=true` or
`premium_module_required=true`. In that mode, startup fails when the configured
premium module is missing. This makes misconfigured paid deployments fail closed
instead of silently running as community edition.

## Module Shape

The module can export a function:

```js
'use strict';

module.exports = function({registry, context}) {
  registry.registerRoute({
    name: 'premium-dashboard',
    path: '/premium/',
    middleware: [],
    router: require('./routes/premium_dashboard'),
  });
};
```

Or an object with a `register` function:

```js
'use strict';

module.exports = {
  register({registry, context}) {
    registry.registerScheduler({
      name: 'premium-job',
      start({models}) {
        return require('./jobs/premium_job').start({models});
      },
    });
  },
};
```

## Available Context

Route registration receives:

- `app` - Express app instance.
- `passport` - configured Passport instance.

Scheduler startup receives:

- `app` - Express app instance.
- `models` - connected DB model object.

Template registration receives the same registry object. Register module-owned
templates before registering routes that render them.

## Registry API

### registerRoute

```js
registry.registerRoute({
  name: 'my-route',
  path: '/my-route/',
  middleware: [myMiddleware],
  router: expressRouter,
});
```

### registerNavigationItem

```js
registry.registerNavigationItem({
  feature: 'time_balance',
  name: 'time-balance',
  path: '/time-balance/',
  labelKey: 'nav.timeBalance',
  location: 'primary',
  icon: 'fa-clock-o',
  order: 10,
});
```

Navigation items are filtered through `features.isEnabled(feature)` before they
are exposed to templates.

### registerNotificationProvider

```js
registry.registerNotificationProvider({
  feature: 'vacation_planning',
  type: 'pending_vacation_plan',
  translationKey: 'pendingVacationPlan',
  link: '/vacation-plans/',
  fetch({model, actingUser}) {
    return require('./model/vacation_plan').promisePendingPlansFor({
      model,
      actingUser,
    });
  },
});
```

Disabled providers are not returned by the registry, so their implementation can
stay in a private module and will not be loaded for community deployments.

### registerViewPath

```js
const path = require('path');

registry.registerViewPath(path.join(__dirname, 'views'));
```

View paths are added to Express with the core `views` directory first, then
premium directories. This lets private modules keep Handlebars templates beside
their route code while still reusing core layouts and partials.

### registerPartialTemplatePath

```js
const path = require('path');

registry.registerPartialTemplatePath(path.join(__dirname, 'views', 'partials'));
```

Partial paths are added to Handlebars with the core partial directory first,
then premium directories. Use this for feature-specific partials that are only
referenced by premium views.

### registerEmailTemplatePath

```js
const path = require('path');

registry.registerEmailTemplatePath(path.join(__dirname, 'views', 'email'));
```

Email template paths let private modules keep feature-specific email templates
outside the core `views/email` directory. The core wrapper template and shared
partials remain available from the community app.

### registerScheduler

```js
registry.registerScheduler({
  name: 'my-scheduler',
  start(context) {
    return {
      stop() {},
    };
  },
});
```

### registerDiagnostic

```js
registry.registerDiagnostic({
  name: 'premium-module',
  collect() {
    return {
      loaded: true,
      moduleName: '@your-company/timeoff-premium',
    };
  },
});
```

Diagnostics must return safe operational metadata only. Do not return raw
licenses, signatures, signing secrets, API tokens, or customer-private data.

## Moving a Feature Into a Private Module

Use this path when extracting a premium feature out of the open-source tree:

1. Move registration into `lib/edition/bundled_premium.js` or a private module
   that follows the same contract.
2. Move the route implementation, views, models, jobs, and feature-specific
   helpers into the private module.
3. Keep stable public URLs by registering the moved routes with
   `registry.registerRoute`.
4. Register module-owned Handlebars templates through `registerViewPath`.
5. Register feature partials through `registerPartialTemplatePath`.
6. Register feature email templates through `registerEmailTemplatePath`.
7. Register any menu entries through `registerNavigationItem`.
8. Register notification counters through `registerNotificationProvider`.
9. Register background jobs through `registerScheduler`.
10. Keep the feature flag in `lib/features.js`; the private module should still
   rely on the same feature name for license checks.
11. In commercial images, set `TIMEOFF_PREMIUM_MODULE_REQUIRED=true` so a missing
   private module fails startup.

The community build should continue to run when the private module is absent.
It should hide premium UI, reject premium direct URLs through feature guards, and
avoid loading private implementation files.
