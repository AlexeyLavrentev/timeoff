'use strict';

const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const { createSessionMiddleware } = require('../auth/session');
const { createWebRoutes } = require('./routes');

const createPortalWebApp = (options = {}) => {
  const { models, signingProvider, sessionSecret, sessionStore } = options;

  const app = express();

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

  app.use(createSessionMiddleware({
    secret: sessionSecret,
    store: sessionStore,
    secure: options.secure || false,
  }));

  app.use('/static', express.static(path.join(__dirname, 'static')));

  app.use('/', createWebRoutes(models, { signingProvider }));

  return app;
};

module.exports = { createPortalWebApp };
