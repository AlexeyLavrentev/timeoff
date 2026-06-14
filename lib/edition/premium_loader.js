'use strict';

const path = require('path');
const config = require('../config');

const resolveModuleName = () =>
  process.env.TIMEOFF_PREMIUM_MODULE
  || config.get('premium_module')
  || '';

const requirePremiumModule = moduleName => {
  if (moduleName.indexOf('.') === 0 || moduleName.indexOf('/') === 0) {
    return require(path.resolve(process.cwd(), moduleName));
  }

  return require(moduleName);
};

const isMissingRequestedModule = (error, moduleName) => (
  error
  && error.code === 'MODULE_NOT_FOUND'
  && (
    error.message.indexOf("'" + moduleName + "'") !== -1
    || error.message.indexOf('"' + moduleName + '"') !== -1
  )
);

const load = ({registry, context, logger}) => {
  const moduleName = resolveModuleName();
  const effectiveLogger = logger || console;

  if (!moduleName) {
    return {
      loaded: false,
      moduleName: null,
    };
  }

  let premiumModule;

  try {
    premiumModule = requirePremiumModule(moduleName);
  } catch (error) {
    if (isMissingRequestedModule(error, moduleName)) {
      effectiveLogger.warn('Premium module not installed: ' + moduleName);
      return {
        loaded: false,
        moduleName,
      };
    }

    throw error;
  }

  if (typeof premiumModule === 'function') {
    premiumModule({registry, context: context || {}});
  } else if (premiumModule && typeof premiumModule.register === 'function') {
    premiumModule.register({registry, context: context || {}});
  } else {
    throw new Error('Premium module must export function or register({registry, context})');
  }

  return {
    loaded: true,
    moduleName,
  };
};

module.exports = {
  load,
  resolveModuleName,
};
