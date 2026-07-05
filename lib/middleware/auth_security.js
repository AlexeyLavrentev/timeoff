'use strict';

const crypto = require('crypto');

const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 10;

const rateLimitState = new Map();

const tokensMatch = (sessionToken, requestToken) => {
  if (typeof sessionToken !== 'string' || typeof requestToken !== 'string') {
    return false;
  }

  const sessionBuffer = Buffer.from(sessionToken);
  const requestBuffer = Buffer.from(requestToken);
  return sessionBuffer.length === requestBuffer.length
    && crypto.timingSafeEqual(sessionBuffer, requestBuffer);
};

const shouldDeferMultipartCsrf = (req, isRegisteredRoute) => {
  return req.method === 'POST'
    && typeof req.is === 'function'
    && !!req.is('multipart/form-data')
    && typeof isRegisteredRoute === 'function'
    && isRegisteredRoute(req.method, req.path);
};

const getClientIp = (req) => {
  // Trust Express' resolved client IP (`req.ip`), which already honours the
  // configured `trust proxy` setting. Parsing X-Forwarded-For manually would let
  // any client spoof the header and bypass rate limiting when the app is not
  // behind a trusted proxy.
  return req.ip
    || req.connection && req.connection.remoteAddress
    || req.socket && req.socket.remoteAddress
    || 'unknown';
};

const getFailureRedirect = (req) => {
  const path = req.path || req.originalUrl || '';

  if (path.indexOf('/reset-password') === 0) {
    const token = (req.body && req.body.t) || (req.query && req.query.t) || '';
    return '/reset-password/?t=' + encodeURIComponent(token);
  }

  if (path.indexOf('/forgot-password') === 0) {
    return '/forgot-password/';
  }

  if (path.indexOf('/register') === 0) {
    return '/register/';
  }

  if (path.indexOf('/login/sso') === 0) {
    return '/login/sso/';
  }

  if (path.indexOf('/login') === 0) {
    return '/login/';
  }

  return '/';
};

const setAuthSecurityHeaders = (req, res, next) => {
  [
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'same-origin'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-site'],
    ['Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"],
  ].forEach(([headerName, headerValue]) => {
    res.setHeader(headerName, headerValue);
  });

  next();
};

const attachCsrfToken = (req, res, next) => {
  if (!req.session) {
    throw new Error('CSRF protection requires session middleware');
  }

  if (!req.session.csrf_token) {
    req.session.csrf_token = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrf_token = req.session.csrf_token;
  next();
};

const verifyCsrfToken = (req, res, next) => {
  const sessionToken = req.session && req.session.csrf_token;
  const requestToken = req.body && req.body._csrf
    || req.headers && req.headers['x-csrf-token'];

  if (!sessionToken || !requestToken) {
    if (req.session && req.session.flash_error) {
      req.session.flash_error(req.t('login.messages.invalidCsrfToken'));
    }
    return res.redirect_with_session(getFailureRedirect(req));
  }

  if (!tokensMatch(sessionToken, requestToken)) {
    if (req.session && req.session.flash_error) {
      req.session.flash_error(req.t('login.messages.invalidCsrfToken'));
    }
    return res.redirect_with_session(getFailureRedirect(req));
  }

  next();
};

const createAuthRateLimit = (options) => {
  if (process.env.DISABLE_AUTH_RATE_LIMIT === 'true') {
    return (req, res, next) => next();
  }

  const windowMs = options && options.windowMs || DEFAULT_RATE_LIMIT_WINDOW_MS;
  const max = options && options.max || DEFAULT_RATE_LIMIT_MAX;
  const keyPrefix = options && options.keyPrefix || 'auth';

  return (req, res, next) => {
    const now = Date.now();
    const key = keyPrefix + ':' + getClientIp(req);
    let entry = rateLimitState.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

      res.setHeader('Retry-After', String(retryAfterSeconds));

      if (req.session && req.session.flash_error) {
        req.session.flash_error(req.t('login.messages.tooManyAuthAttempts', {
          seconds: retryAfterSeconds,
        }));
      }

      rateLimitState.set(key, entry);
      return res.redirect_with_session(getFailureRedirect(req));
    }

    entry.count += 1;
    rateLimitState.set(key, entry);

    next();
  };
};

const resetAuthRateLimitStore = () => {
  rateLimitState.clear();
};

module.exports = {
  attachCsrfToken,
  createAuthRateLimit,
  resetAuthRateLimitStore,
  setAuthSecurityHeaders,
  tokensMatch,
  shouldDeferMultipartCsrf,
  verifyCsrfToken,
};
