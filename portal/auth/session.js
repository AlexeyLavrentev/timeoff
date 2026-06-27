'use strict';

const session = require('express-session');

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

const createSessionMiddleware = (options = {}) => {
  return session({
    secret: options.secret || process.env.PORTAL_SESSION_SECRET || 'portal-dev-secret',
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
