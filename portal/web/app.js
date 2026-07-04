'use strict';

const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const { createSessionMiddleware } = require('../auth/session');
const { createWebRoutes } = require('./routes');
const { setPortalSecurityHeaders } = require('./security_headers');
const { createPortalRouter, createAuthRouter } = require('../api/router');
const { createTrialRoutes } = require('../trial/routes');

const PORTAL_API_PREFIX = '/api/v1';

const safeApiError = (_error, _req, res, _next) => {
  res.status(500).json({ error: 'Internal server error' });
};

const createPortalWebApp = (options = {}) => {
  const { models, signingProvider, sessionSecret, sessionStore } = options;

  const app = express();
  app.set('trust proxy', options.trustProxy || false);

  const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    helpers: {
      eq: (a, b) => a === b,
    },
  });

  app.engine('.hbs', hbs.engine);
  app.set('view engine', '.hbs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(setPortalSecurityHeaders);

  app.use(createSessionMiddleware({
    secret: sessionSecret,
    store: sessionStore,
    secure: options.secure || false,
    nodeEnv: options.nodeEnv,
  }));

  app.use('/static', express.static(path.join(__dirname, 'static')));

  app.use((req, res, next) => {
    res.locals.trialEnabled = options.trialConfig && options.trialConfig.trialEnabled === true;
    next();
  });

  if (options.trialConfig && options.trialConfig.trialEnabled === true) {
    app.use('/trial', createTrialRoutes(models, {
      signingProvider,
      mailer: options.trialMailer,
      config: options.trialConfig,
    }));
  }

  if (options.apiEnabled === true) {
    app.use(PORTAL_API_PREFIX + '/auth', createAuthRouter(models));
    app.use(PORTAL_API_PREFIX, createPortalRouter(models, signingProvider));
    app.use(PORTAL_API_PREFIX, safeApiError);
  }

  app.use('/', createWebRoutes(models, { signingProvider }));

  return app;
};

module.exports = { PORTAL_API_PREFIX, createPortalWebApp, safeApiError };
