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

  it('compares CSRF tokens safely for delayed multipart parsing', function() {
    expect(authSecurity.tokensMatch('expected-token', 'expected-token')).to.equal(true);
    expect(authSecurity.tokensMatch('expected-token', 'invalid-token')).to.equal(false);
    expect(authSecurity.tokensMatch('expected-token', undefined)).to.equal(false);
  });

  it('defers CSRF only for an exact registered multipart POST route', function() {
    const registered = function(method, path) {
      return method === 'POST' && path === '/users/import/';
    };
    const request = createReq({
      method: 'POST',
      path: '/users/import/',
      is: function(type) { return type === 'multipart/form-data' ? 'multipart/form-data' : false; },
    });

    expect(authSecurity.shouldDeferMultipartCsrf(request, registered)).to.equal(true);
    expect(authSecurity.shouldDeferMultipartCsrf(Object.assign({}, request, {path: '/users/import'}), registered)).to.equal(false);
    expect(authSecurity.shouldDeferMultipartCsrf(Object.assign({}, request, {method: 'GET'}), registered)).to.equal(false);
    expect(authSecurity.shouldDeferMultipartCsrf(Object.assign({}, request, {is: function() { return false; }}), registered)).to.equal(false);
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

  it('keys rate limiting on req.ip so a spoofed X-Forwarded-For cannot bypass it', function() {
    const limiter = authSecurity.createAuthRateLimit({
      max: 2,
      windowMs: 60 * 1000,
      keyPrefix: 'test-spoof',
    });

    // Same real client (req.ip), attacker rotates X-Forwarded-For each request.
    function attempt(spoofedXff) {
      const req = createReq({
        ip: '10.0.0.5',
        headers: { 'x-forwarded-for': spoofedXff },
      });
      const res = createRes();
      let allowed = false;

      limiter(req, res, function() {
        allowed = true;
      });

      return { allowed: allowed, res: res };
    }

    expect(attempt('1.1.1.1').allowed).to.equal(true);
    expect(attempt('2.2.2.2').allowed).to.equal(true);

    const third = attempt('3.3.3.3');
    expect(third.allowed).to.equal(false);
    expect(third.res.headers['Retry-After']).to.equal('60');
  });
});
