'use strict';

const expect = require('chai').expect;
const flashMessages = require('../../../lib/middleware/flash_messages');
const config = require('../../../lib/config');
const loginRouterFactory = require('../../../lib/route/login');

function getRouteHandler(router, path, method) {
  const layer = router.stack.find(item =>
    item.route
    && item.route.path === path
    && item.route.methods
    && item.route.methods[method]
  );

  if (!layer) {
    throw new Error('Failed to find route handler for ' + method + ' ' + path);
  }

  return layer.route.stack[0].handle;
}

function getRouteHandlers(router, path, method) {
  const layer = router.stack.find(item =>
    item.route
    && item.route.path === path
    && item.route.methods
    && item.route.methods[method]
  );

  if (!layer) {
    throw new Error('Failed to find route handlers for ' + method + ' ' + path);
  }

  return layer.route.stack.map(item => item.handle);
}

function createReq(overrides) {
  const req = Object.assign({
    body: {},
    session: {},
    user: null,
    app: {
      get() {
        return undefined;
      },
    },
    get(headerName) {
      if (headerName === 'host') {
        return 'localhost:3000';
      }

      return '';
    },
    t(key) {
      return key;
    },
  }, overrides || {});

  flashMessages(req, { locals: {} }, function() {});

  return req;
}

function invokeRoute(handler, req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for route response'));
    }, 500);

    const res = {
      locals: {
        url_to_the_site_root: '/',
        flash: null,
      },
      redirect_with_session(statusOrLocation, maybeLocation) {
        clearTimeout(timer);

        const location = typeof maybeLocation === 'undefined'
          ? statusOrLocation
          : maybeLocation;

        resolve({
          type: 'redirect',
          location: location,
        });
      },
      render(view, data) {
        clearTimeout(timer);
        resolve({
          type: 'render',
          view: view,
          data: data,
        });
      },
    };

    try {
      handler(req, res, reject);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

function invokeRouteHandlers(handlers, req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for route response'));
    }, 500);

    const res = {
      locals: {
        url_to_the_site_root: '/',
        flash: null,
      },
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      redirect_with_session(statusOrLocation, maybeLocation) {
        clearTimeout(timer);

        const location = typeof maybeLocation === 'undefined'
          ? statusOrLocation
          : maybeLocation;

        resolve({
          type: 'redirect',
          location: location,
          req: req,
          res: this,
        });
      },
      render(view, data) {
        clearTimeout(timer);
        resolve({
          type: 'render',
          view: view,
          data: data,
          req: req,
          res: this,
        });
      },
    };

    let currentIndex = 0;

    const next = function(error) {
      if (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }

      const handler = handlers[currentIndex++];

      if (!handler) {
        clearTimeout(timer);
        resolve({
          type: 'next',
          req: req,
          res: res,
        });
        return;
      }

      try {
        handler(req, res, next);
      } catch (handlerError) {
        clearTimeout(timer);
        reject(handlerError);
      }
    };

    next();
  });
}

describe('Register route', function() {
  const router = loginRouterFactory({
    authenticate() {
      return function(req, res, next) {
        return next && next();
      };
    },
  });
  const getRegisterHandlers = getRouteHandlers(router, '/register', 'get');
  const postRegisterHandlers = getRouteHandlers(router, '/register', 'post');
  let originalAllowCreateNewAccounts;

  beforeEach(function() {
    originalAllowCreateNewAccounts = config.get('allow_create_new_accounts');
    config.set('allow_create_new_accounts', false);
  });

  afterEach(function() {
    config.set('allow_create_new_accounts', originalAllowCreateNewAccounts);
  });

  it('redirects GET /register when self-signup is disabled', async function() {
    const result = await invokeRouteHandlers(getRegisterHandlers, createReq());

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/');
  });

  it('redirects POST /register when self-signup is disabled', async function() {
    const req = createReq({
      body: {
        email: 'admin@example.com',
        name: 'Admin',
        lastname: 'User',
        company_name: 'Corp',
        password: 'secret',
        password_confirmed: 'secret',
        country: 'GB',
        timezone: 'Europe/London',
      },
      session: {
        csrf_token: 'expected-token',
      },
    });
    req.body._csrf = 'expected-token';

    const result = await invokeRouteHandlers(postRegisterHandlers, req);

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/');
  });

  it('blocks POST /register without valid csrf token before processing payload', async function() {
    config.set('allow_create_new_accounts', true);

    const req = createReq({
      body: {
        email: 'admin@example.com',
        name: 'Admin',
        lastname: 'User',
        company_name: 'Corp',
        password: 'secret',
        password_confirmed: 'secret',
        country: 'GB',
        timezone: 'Europe/London',
      },
      session: {
        csrf_token: 'expected-token',
      },
    });

    flashMessages(req, { locals: {} }, function() {});

    const result = await invokeRouteHandlers(postRegisterHandlers, req);

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/register/');
    expect(req.session.flash.errors).to.deep.equal([
      'login.messages.invalidCsrfToken',
    ]);
  });
});
