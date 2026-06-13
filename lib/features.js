'use strict';

const config = require('./config');

const FEATURE_CATALOG = {
  sso_authentication: { defaultEnabled: false },
  integration_api: { defaultEnabled: false },
  time_balance: { defaultEnabled: false },
  vacation_planning: { defaultEnabled: false },
  employee_groups: { defaultEnabled: false },
  work_calendars: { defaultEnabled: false },
  leave_start_reminders: { defaultEnabled: false },
};

const PRODUCTION_LIKE_ENVIRONMENTS = ['production', 'staging'];

const normalizeFeatureName = name => String(name || '').trim().toLowerCase();

const parseList = value => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFeatureName).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map(normalizeFeatureName)
    .filter(Boolean);
};

const parseBoolean = value => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].indexOf(value.toLowerCase()) !== -1;
  }

  return !!value;
};

const readLicensePayload = () => {
  const raw = process.env.TIMEOFF_LICENSE || config.get('license');

  if (!raw) {
    return {};
  }

  if (typeof raw === 'object') {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch (jsonError) {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (base64Error) {
      return {};
    }
  }
};

const productionLikeEnvironment = () =>
  PRODUCTION_LIKE_ENVIRONMENTS.indexOf(process.env.NODE_ENV) !== -1;

const allowUnlicensedFeatureOverrides = () => {
  if (typeof process.env.ALLOW_UNLICENSED_FEATURE_OVERRIDES !== 'undefined') {
    return parseBoolean(process.env.ALLOW_UNLICENSED_FEATURE_OVERRIDES);
  }

  const configuredValue = config.get('allow_unlicensed_feature_overrides');

  if (typeof configuredValue !== 'undefined') {
    return parseBoolean(configuredValue);
  }

  return !productionLikeEnvironment();
};

const getExplicitFeatureOverrides = () => {
  const overrides = {};
  const configuredFeatures = config.get('features') || {};

  Object.keys(configuredFeatures).forEach(name => {
    overrides[normalizeFeatureName(name)] = parseBoolean(configuredFeatures[name]);
  });

  Object.keys(FEATURE_CATALOG).forEach(name => {
    const envKey = 'FEATURE_' + name.toUpperCase();

    if (typeof process.env[envKey] !== 'undefined') {
      overrides[name] = parseBoolean(process.env[envKey]);
    }
  });

  return overrides;
};

const getRequestedFeatureSet = () => {
  const values = parseList(process.env.TIMEOFF_FEATURES);

  if (values.indexOf('all') !== -1) {
    return new Set(Object.keys(FEATURE_CATALOG));
  }

  return new Set(values.filter(name => FEATURE_CATALOG[name]));
};

const getLicensedFeatureSet = () => {
  const payload = readLicensePayload();
  const configuredFeatures = parseList(config.get('licensed_features'));
  const licensedFeatures = parseList(payload.features);
  const values = configuredFeatures.concat(licensedFeatures);

  if (values.indexOf('all') !== -1) {
    return new Set(Object.keys(FEATURE_CATALOG));
  }

  return new Set(values.filter(name => FEATURE_CATALOG[name]));
};

const isEnabled = featureName => {
  const name = normalizeFeatureName(featureName);
  const feature = FEATURE_CATALOG[name];

  if (!feature) {
    return false;
  }

  const overrides = getExplicitFeatureOverrides();

  if (Object.prototype.hasOwnProperty.call(overrides, name) && overrides[name] === false) {
    return false;
  }

  const licensedFeatures = getLicensedFeatureSet();

  if (licensedFeatures.has(name)) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(overrides, name)) {
    return overrides[name] && allowUnlicensedFeatureOverrides();
  }

  if (getRequestedFeatureSet().has(name)) {
    return allowUnlicensedFeatureOverrides();
  }

  return feature.defaultEnabled;
};

const getEnabledMap = () => Object.keys(FEATURE_CATALOG).reduce((acc, name) => {
  acc[name] = isEnabled(name);
  return acc;
}, {});

const wantsJsonResponse = req =>
  req.xhr
  || (req.accepts && req.accepts(['html', 'json']) === 'json')
  || /^\/(api|integration)\//.test(req.originalUrl || req.url || '');

const requireFeature = featureName => (req, res, next) => {
  if (isEnabled(featureName)) {
    return next();
  }

  if (wantsJsonResponse(req)) {
    return res.status(403).json({
      error: 'feature_disabled',
      feature: normalizeFeatureName(featureName),
      message: req.t ? req.t('features.messages.disabled') : 'Feature is disabled',
    });
  }

  if (req.session && req.session.flash_error && req.t) {
    req.session.flash_error(req.t('features.messages.disabled'));
  }

  return res.redirect_with_session ? res.redirect_with_session('/') : res.redirect('/');
};

module.exports = {
  catalog: FEATURE_CATALOG,
  isEnabled,
  getEnabledMap,
  requireFeature,
  allowUnlicensedFeatureOverrides,
};
