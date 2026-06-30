'use strict';

const crypto = require('crypto');

const HEADER_NAME = 'x-csrf-token';

const issueCsrfToken = req => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
};

const rotateCsrfToken = req => {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
};

const tokensMatch = (provided, expected) => {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const requireCsrfToken = (req, res, next) => {
  const provided = req.get(HEADER_NAME);
  const expected = req.session && req.session.csrfToken;

  if (!tokensMatch(provided, expected)) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
};

module.exports = {
  HEADER_NAME,
  issueCsrfToken,
  requireCsrfToken,
  rotateCsrfToken,
  tokensMatch,
};
