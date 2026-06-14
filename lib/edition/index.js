'use strict';

const EditionRegistry = require('./registry');
const community = require('./community');
const premiumLoader = require('./premium_loader');

const registry = new EditionRegistry();

let initialized = false;
let communityInfo = null;
let premiumInfo = null;

const initialize = context => {
  if (initialized) {
    return {
      community: communityInfo,
      premium: premiumInfo,
    };
  }

  const effectiveContext = context || {};

  communityInfo = community.register({
    registry,
    context: effectiveContext,
  });
  premiumInfo = premiumLoader.load({
    registry,
    context: effectiveContext,
    logger: effectiveContext.logger,
  });
  initialized = true;

  return {
    community: communityInfo,
    premium: premiumInfo,
  };
};

const registerRoutes = (app, context) => {
  initialize(context);
  registry.applyRoutes(app);
};

const startSchedulers = context => {
  initialize(context);
  return registry.startSchedulers(context);
};

const getInfo = () => ({
  initialized,
  community: communityInfo,
  premium: premiumInfo,
  routes: registry.getRoutes().map(route => ({
    name: route.name,
    path: route.path,
  })),
  schedulers: registry.getSchedulers().map(scheduler => ({
    name: scheduler.name,
  })),
});

module.exports = {
  getInfo,
  getRegistry: () => registry,
  initialize,
  registerRoutes,
  startSchedulers,
};
