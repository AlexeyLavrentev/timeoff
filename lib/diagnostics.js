'use strict';

const edition = require('./edition');
const features = require('./features');
const packageInfo = require('../package.json');

const SENSITIVE_KEY_PATTERN = /(?:raw|signature|secret|password|token|private.?key|public.?key|authorization|cookie)/i;

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((result, key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return result;
      }

      result[key] = sanitize(value[key]);
      return result;
    }, {});
  }

  return value;
}

function summarizeEditionInfo(info) {
  const editionInfo = info || {};

  return {
    initialized: !!editionInfo.initialized,
    premium: {
      loaded: !!(editionInfo.premium && editionInfo.premium.loaded),
      moduleName: editionInfo.premium && editionInfo.premium.moduleName || null,
      required: !!(editionInfo.premium && editionInfo.premium.required),
    },
    counts: {
      routes: (editionInfo.routes || []).length,
      schedulers: (editionInfo.schedulers || []).length,
      navigationItems: (editionInfo.navigationItems || []).length,
      notificationProviders: (editionInfo.notificationProviders || []).length,
      diagnostics: (editionInfo.diagnostics || []).length,
      viewPaths: (editionInfo.viewPaths || []).length,
      emailTemplatePaths: (editionInfo.emailTemplatePaths || []).length,
      partialTemplatePaths: (editionInfo.partialTemplatePaths || []).length,
      dbModelPaths: (editionInfo.dbModelPaths || []).length,
      localePaths: (editionInfo.localePaths || []).length,
      migrationPaths: (editionInfo.migrationPaths || []).length,
      dbAssociations: (editionInfo.dbAssociations || []).length,
    },
    routes: (editionInfo.routes || []).map(route => ({
      name: route.name,
      path: route.path,
    })),
    navigationItems: (editionInfo.navigationItems || []).map(item => ({
      name: item.name,
      feature: item.feature,
      location: item.location,
    })),
    notificationProviders: (editionInfo.notificationProviders || []).map(provider => ({
      type: provider.type,
      feature: provider.feature,
    })),
    dbAssociations: (editionInfo.dbAssociations || []).map(dbAssociation => ({
      name: dbAssociation.name,
    })),
  };
}

async function collect(options) {
  const deps = options || {};
  const editionModule = deps.edition || edition;
  const featuresModule = deps.features || features;
  const environment = deps.env || process.env;
  const editionInfo = editionModule.getInfo();
  const moduleDiagnostics = typeof editionModule.collectDiagnostics === 'function'
    ? await editionModule.collectDiagnostics()
    : [];

  return sanitize({
    generatedAt: new Date().toISOString(),
    application: {
      name: packageInfo.name,
      version: packageInfo.version,
      revision: environment.APP_REVISION || environment.GIT_COMMIT || null,
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    environment: {
      nodeEnv: environment.NODE_ENV || 'development',
    },
    license: featuresModule.getLicenseStatus(),
    enabledFeatures: featuresModule.getEnabledMap(),
    edition: summarizeEditionInfo(editionInfo),
    moduleDiagnostics,
  });
}

module.exports = {
  collect,
  sanitize,
  summarizeEditionInfo,
};
