'use strict';

const features = require('../features');

const cloneRoute = route => ({
  name       : route.name,
  path       : route.path,
  middleware : Array.isArray(route.middleware) ? route.middleware.slice() : [],
  router     : route.router,
});

const cloneScheduler = scheduler => ({
  name  : scheduler.name,
  start : scheduler.start,
});

const cloneNavigationItem = item => Object.assign({}, item);
const cloneNotificationProvider = provider => Object.assign({}, provider);
const cloneDiagnostic = diagnostic => Object.assign({}, diagnostic);
const cloneViewPath = viewPath => viewPath;

function EditionRegistry() {
  this.routes = [];
  this.schedulers = [];
  this.navigationItems = [];
  this.notificationProviders = [];
  this.diagnostics = [];
  this.viewPaths = [];
}

EditionRegistry.prototype.registerRoute = function(route) {
  if (!route || !route.path || !route.router) {
    throw new Error('Edition route requires path and router');
  }

  this.routes.push({
    name       : route.name || route.path,
    path       : route.path,
    middleware : route.middleware || [],
    router     : route.router,
  });
};

EditionRegistry.prototype.getRoutes = function() {
  return this.routes.map(cloneRoute);
};

EditionRegistry.prototype.applyRoutes = function(app) {
  this.routes.forEach(function(route) {
    var middleware = Array.isArray(route.middleware)
      ? route.middleware
      : [route.middleware];

    app.use.apply(app, [route.path].concat(middleware).concat(route.router));
  });
};

EditionRegistry.prototype.registerScheduler = function(scheduler) {
  if (!scheduler || !scheduler.name || typeof scheduler.start !== 'function') {
    throw new Error('Edition scheduler requires name and start function');
  }

  this.schedulers.push({
    name  : scheduler.name,
    start : scheduler.start,
  });
};

EditionRegistry.prototype.getSchedulers = function() {
  return this.schedulers.map(cloneScheduler);
};

EditionRegistry.prototype.startSchedulers = function(context) {
  return this.schedulers.map(function(scheduler) {
    return {
      name   : scheduler.name,
      handle : scheduler.start(context || {}),
    };
  });
};

EditionRegistry.prototype.registerNavigationItem = function(item) {
  if (!item || !item.feature || !item.name || !item.path || !item.labelKey || !item.location) {
    throw new Error('Edition navigation item requires feature, name, path, labelKey, and location');
  }

  this.navigationItems.push({
    feature  : item.feature,
    name     : item.name,
    path     : item.path,
    labelKey : item.labelKey,
    location : item.location,
    icon     : item.icon || null,
    badgeId  : item.badgeId || null,
    order    : item.order || 0,
  });
};

EditionRegistry.prototype.getNavigationItems = function(options) {
  const opts = options || {};

  return this.navigationItems
    .filter(item => !opts.location || item.location === opts.location)
    .filter(item => opts.enabledOnly === false || features.isEnabled(item.feature))
    .sort((a, b) => a.order - b.order)
    .map(cloneNavigationItem);
};

EditionRegistry.prototype.registerNotificationProvider = function(provider) {
  if (!provider || !provider.feature || !provider.type || typeof provider.fetch !== 'function') {
    throw new Error('Edition notification provider requires feature, type, and fetch function');
  }

  this.notificationProviders.push({
    feature        : provider.feature,
    type           : provider.type,
    translationKey : provider.translationKey || provider.type,
    link           : provider.link || null,
    fetch          : provider.fetch,
    order          : provider.order || 0,
  });
};

EditionRegistry.prototype.getNotificationProviders = function(options) {
  const opts = options || {};

  return this.notificationProviders
    .filter(provider => opts.enabledOnly === false || features.isEnabled(provider.feature))
    .sort((a, b) => a.order - b.order)
    .map(cloneNotificationProvider);
};

EditionRegistry.prototype.registerDiagnostic = function(diagnostic) {
  if (!diagnostic || !diagnostic.name || typeof diagnostic.collect !== 'function') {
    throw new Error('Edition diagnostic requires name and collect function');
  }

  this.diagnostics.push({
    name    : diagnostic.name,
    collect : diagnostic.collect,
  });
};

EditionRegistry.prototype.getDiagnostics = function() {
  return this.diagnostics.map(cloneDiagnostic);
};

EditionRegistry.prototype.collectDiagnostics = function(context) {
  return Promise.all(this.diagnostics.map(diagnostic =>
    Promise.resolve(diagnostic.collect(context || {}))
      .then(result => Object.assign({ name : diagnostic.name }, result || {}))
  ));
};

EditionRegistry.prototype.registerViewPath = function(viewPath) {
  if (!viewPath || typeof viewPath !== 'string') {
    throw new Error('Edition view path requires a string path');
  }

  if (this.viewPaths.indexOf(viewPath) === -1) {
    this.viewPaths.push(viewPath);
  }
};

EditionRegistry.prototype.getViewPaths = function() {
  return this.viewPaths.map(cloneViewPath);
};

EditionRegistry.prototype.applyViewPaths = function(app, basePaths) {
  var normalizedBasePaths = Array.isArray(basePaths)
    ? basePaths.slice()
    : [basePaths];
  var paths = normalizedBasePaths
    .concat(this.viewPaths)
    .filter(Boolean)
    .filter(function(viewPath, index, allPaths) {
      return allPaths.indexOf(viewPath) === index;
    });

  app.set('views', paths);
  return paths.slice();
};

module.exports = EditionRegistry;
