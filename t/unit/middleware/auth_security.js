'use strict';

const expect = require('chai').expect;
const flashMessages = require('../../../lib/middleware/flash_messages');
const authSecurity = require('../../../lib/middleware/auth_security');

function createReq(overrides) {
  const req = Object.assign({
    body: {},
    headers: {},
    path: '/login',
    session: {},
    t(key, params) {
      if (key === 'login.messages.invalidCsrfToken') {
        return 'Your form session expired. Please try again.';
      }

      if (key === 'login.messages.tooManyAuthAttempts') {
        return 'Too many authentication attempts. Please try again in ' + params.seconds + ' seconds.';
      }

      return key;
    },
  }, overrides || {});

  flashMessages(req, { locals: {} }, function() {});

  return req;
}

function createRes() {
  return {
    headers: {},
    locals: {},
    redirects: [],
    setHeader(name, value) {
      this.headers[name] = value;
    },
    redirect_with_session(location) {
      this.redirects.push(location);
      return location;
    },
  };
}

describe('auth security middleware', function() {
  beforeEach(function() {
    authSecurity.resetAuthRateLimitStore();
  });

  it('attaches CSP and related security headers', function(done) {
    const res = createRes();

    authSecurity.setAuthSecurityHeaders(createReq(), res, function() {
      expect(res.headers['X-Frame-Options']).to.equal('DENY');
      expect(res.headers['X-Content-Type-Options']).to.equal('nosniff');
      expect(res.headers['Content-Security-Policy']).to.contain("frame-ancestors 'none'");
      done();
    });
  });

  it('creates and exposes csrf token in session and templates', function(done) {
    const req = createReq();
    const res = createRes();

    authSecurity.attachCsrfToken(req, res, function() {
      expect(req.session.csrf_token).to.be.a('string');
      expect(res.locals.csrf_token).to.equal(req.session.csrf_token);
      done();
    });
  });

  it('rejects invalid csrf token for login form', function() {
    const req = createReq({
      body: {
        _csrf: 'invalid-token',
      },
      session: {
        csrf_token: 'expected-token',
      },
    });
    const res = createRes();

    authSecurity.verifyCsrfToken(req, res, function() {
      throw new Error('next should not be called');
    });

    expect(res.redirects).to.deep.equal(['/login/']);
    expect(req.session.flash.errors).to.deep.equal([
      'Your form session expired. Please try again.',
    ]);
  });

  it('limits repeated auth attempts by client ip', function() {
    const limiter = authSecurity.createAuthRateLimit({
      max: 1,
      windowMs: 60 * 1000,
      keyPrefix: 'test-login',
    });
    const req = createReq({
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });
    const firstRes = createRes();
    const secondRes = createRes();
    let firstAllowed = false;

    limiter(req, firstRes, function() {
      firstAllowed = true;
    });

    limiter(req, secondRes, function() {
      throw new Error('second request should be blocked');
    });

    expect(firstAllowed).to.equal(true);
    expect(secondRes.headers['Retry-After']).to.equal('60');
    expect(secondRes.redirects).to.deep.equal(['/login/']);
    expect(req.session.flash.errors).to.deep.equal([
      'Too many authentication attempts. Please try again in 60 seconds.',
    ]);
  });
});
