'use strict';

function EditionRegistry() {
  this.routes = [];
  this.schedulers = [];
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
  return this.routes.slice();
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
  return this.schedulers.slice();
};

EditionRegistry.prototype.startSchedulers = function(context) {
  return this.schedulers.map(function(scheduler) {
    return {
      name   : scheduler.name,
      handle : scheduler.start(context || {}),
    };
  });
};

module.exports = EditionRegistry;
