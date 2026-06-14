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

const getNavigationItems = (options, context) => {
  initialize(context);
  return registry.getNavigationItems(options);
};

const getNotificationProviders = (options, context) => {
  initialize(context);
  return registry.getNotificationProviders(options);
};

const collectDiagnostics = context => {
  initialize(context);
  return registry.collectDiagnostics(context);
};

const getViewPaths = context => {
  initialize(context);
  return registry.getViewPaths();
};

const applyViewPaths = (app, basePaths, context) => {
  initialize(context);
  return registry.applyViewPaths(app, basePaths);
};

const getEmailTemplatePaths = context => {
  initialize(context);
  return registry.getEmailTemplatePaths();
};

const getPartialTemplatePaths = context => {
  initialize(context);
  return registry.getPartialTemplatePaths();
};

const getDbModelPaths = context => {
  initialize(context);
  return registry.getDbModelPaths();
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
  navigationItems: registry.getNavigationItems({enabledOnly: false}).map(item => ({
    name: item.name,
    feature: item.feature,
    location: item.location,
  })),
  notificationProviders: registry.getNotificationProviders({enabledOnly: false}).map(provider => ({
    type: provider.type,
    feature: provider.feature,
  })),
  diagnostics: registry.getDiagnostics().map(diagnostic => ({
    name: diagnostic.name,
  })),
  viewPaths: registry.getViewPaths(),
  emailTemplatePaths: registry.getEmailTemplatePaths(),
  partialTemplatePaths: registry.getPartialTemplatePaths(),
  dbModelPaths: registry.getDbModelPaths(),
});

module.exports = {
  applyViewPaths,
  getInfo,
  getRegistry: () => registry,
  collectDiagnostics,
  getDbModelPaths,
  getEmailTemplatePaths,
  getNavigationItems,
  getNotificationProviders,
  getPartialTemplatePaths,
  getViewPaths,
  initialize,
  registerRoutes,
  startSchedulers,
};
