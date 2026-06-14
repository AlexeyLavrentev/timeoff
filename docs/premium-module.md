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
