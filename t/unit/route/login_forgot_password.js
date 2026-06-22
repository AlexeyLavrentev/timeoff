'use strict';

const expect = require('chai').expect;
const flashMessages = require('../../../lib/middleware/flash_messages');

const emailModulePath = require.resolve('../../../lib/email');
const loginRoutePath = require.resolve('../../../lib/route/login');

let emailSendAttempts = 0;

function FakeEmailTransport() {}
FakeEmailTransport.prototype.promise_forgot_password_email = function() {
  emailSendAttempts += 1;
  return Promise.resolve();
};
FakeEmailTransport.prototype.promise_reset_password_email = function() {
  emailSendAttempts += 1;
  return Promise.resolve();
};

require.cache[emailModulePath] = {
  id: emailModulePath,
  filename: emailModulePath,
  loaded: true,
  exports: FakeEmailTransport,
};

delete require.cache[loginRoutePath];
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
    app: {
      get(key) {
        if (key === 'db_model') {
          return {
            User: {
              find_by_email() {
                return Promise.resolve(null);
              },
            },
          };
        }

        return undefined;
      },
    },
    t(key) {
      const translations = {
        'login.messages.emailMissing': 'Email was not provided',
        'login.messages.emailInvalid': 'Email address is invalid',
        'login.messages.forgotPasswordSent': 'Please check your email box for further instructions',
        'login.messages.forgotPasswordFailed': 'Failed to proceed with submitted data.',
        'login.messages.useSsoPasswordRecovery': 'This account uses SSO. Reset your password through your company identity provider.',
        'login.messages.passwordBlank': 'Password cannot be blank',
        'login.messages.resetPasswordMismatch': 'Confirmed password does not match password',
        'login.messages.resetLinkUnknown': 'Unknown reset password link, please submit request again',
        'login.messages.resetPasswordFailed': 'Failed to reset the password. Please request a new link.',
        'login.messages.resetPasswordUseNew': 'Please use new password to login into system',
      };

      return translations[key] || key;
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
        flash: null,
      },
      statusCode: 200,
      redirect_with_session(location) {
        clearTimeout(timer);
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
        flash: null,
      },
      headers: {},
      statusCode: 200,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      redirect_with_session(location) {
        clearTimeout(timer);
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

describe('Forgot password route', function() {
  const router = loginRouterFactory({
    authenticate() {
      return function(req, res, next) {
        return next && next();
      };
    },
  });
  const postForgotPasswordHandlers = getRouteHandlers(router, '/forgot-password/', 'post');

  beforeEach(function() {
    emailSendAttempts = 0;
  });

  it('redirects SSO users to SSO login instead of sending password reset email', async function() {
    const originalFeatureFlag = process.env.FEATURE_SSO_AUTHENTICATION;
    process.env.FEATURE_SSO_AUTHENTICATION = 'true';
    const user = {
      getCompany() {
        return Promise.resolve({
          sso_auth_enabled: true,
        });
      },
    };

    const req = createReq({
      body: {
        email: 'sso-user@example.com',
        _csrf: 'expected-token',
      },
      path: '/forgot-password/',
      session: {
        csrf_token: 'expected-token',
      },
      app: {
        get(key) {
          if (key === 'db_model') {
            return {
              User: {
                find_by_email(email) {
                  expect(email).to.equal('sso-user@example.com');
                  return Promise.resolve(user);
                },
              },
            };
          }

          return undefined;
        },
      },
    });

    let result;
    try {
      result = await invokeRouteHandlers(postForgotPasswordHandlers, req);
    } finally {
      if (typeof originalFeatureFlag === 'undefined') {
        delete process.env.FEATURE_SSO_AUTHENTICATION;
      } else {
        process.env.FEATURE_SSO_AUTHENTICATION = originalFeatureFlag;
      }
    }

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/login/sso/');
    expect(emailSendAttempts).to.equal(0);
    expect(req.session.flash.warnings).to.deep.equal([
      'This account uses SSO. Reset your password through your company identity provider.',
    ]);
  });
});

describe('Reset password route', function() {
  const router = loginRouterFactory({
    authenticate() {
      return function(req, res, next) {
        return next && next();
      };
    },
  });
  const postResetPasswordHandlers = getRouteHandlers(router, '/reset-password/', 'post');

  beforeEach(function() {
    emailSendAttempts = 0;
  });

  it('stops after redirecting an invalid token', async function() {
    let hashAttempts = 0;
    const req = createReq({
      body: {
        t: 'invalid',
        password: 'new-password',
        confirm_password: 'new-password',
        _csrf: 'expected-token',
      },
      path: '/reset-password/',
      session: {
        csrf_token: 'expected-token',
      },
      app: {
        get(key) {
          if (key === 'db_model') {
            return {
              User: {
                get_user_by_reset_password_token() {
                  return Promise.resolve();
                },
                hashify_password() {
                  hashAttempts += 1;
                },
              },
            };
          }
        },
      },
    });

    const result = await invokeRouteHandlers(postResetPasswordHandlers, req);

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/forgot-password/');
    expect(hashAttempts).to.equal(0);
    expect(emailSendAttempts).to.equal(0);
  });

  it('rejects a blank password before looking up the token', async function() {
    let lookupAttempts = 0;
    const req = createReq({
      body: {
        t: 'token',
        password: '',
        confirm_password: '',
        _csrf: 'expected-token',
      },
      path: '/reset-password/',
      session: {
        csrf_token: 'expected-token',
      },
      app: {
        get(key) {
          if (key === 'db_model') {
            return {
              User: {
                get_user_by_reset_password_token() {
                  lookupAttempts += 1;
                  return Promise.resolve();
                },
              },
            };
          }
        },
      },
    });

    const result = await invokeRouteHandlers(postResetPasswordHandlers, req);

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/reset-password/?t=token');
    expect(lookupAttempts).to.equal(0);
    expect(req.session.flash.errors).to.deep.equal(['Password cannot be blank']);
  });
});
