'use strict';

const session = require('express-session');

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

const createSessionMiddleware = (options = {}) => {
  const isProduction = (options.nodeEnv || process.env.NODE_ENV || '') === 'production';
  const secret = options.secret || process.env.PORTAL_SESSION_SECRET;

  if (!secret) {
    if (isProduction) {
      throw new Error('PORTAL_SESSION_SECRET is required in production');
    }
    return session({
      secret: 'portal-dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
      },
      store: options.store || undefined,
    });
  }

  return session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: options.secure || false,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
    },
    store: options.store || undefined,
  });
};

module.exports = { createSessionMiddleware, SESSION_MAX_AGE };
