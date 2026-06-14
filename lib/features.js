'use strict';

const crypto = require('crypto');
const config = require('./config');

const FEATURE_CATALOG = {
  sso_authentication: { defaultEnabled: false },
  integration_api: { defaultEnabled: false },
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

const registerFeature = (name, options) => {
  const normalizedName = normalizeFeatureName(name);

  if (!normalizedName) {
    throw new Error('Feature name is required');
  }

  FEATURE_CATALOG[normalizedName] = {
    defaultEnabled: !!(options && options.defaultEnabled),
  };
};

const productionLikeEnvironment = () =>
  PRODUCTION_LIKE_ENVIRONMENTS.indexOf(process.env.NODE_ENV) !== -1;

const canonicalize = value => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }

  return value;
};

const canonicalJson = value => JSON.stringify(canonicalize(value));

const getLicenseSecret = () =>
  process.env.TIMEOFF_LICENSE_SECRET || config.get('license_secret') || '';

const signLicensePayload = (payload, secret) =>
  crypto
    .createHmac('sha256', secret)
    .update(canonicalJson(payload))
    .digest('hex');

const signaturesMatch = (expected, actual) => {
  const expectedBuffer = Buffer.from(String(expected || ''), 'hex');
  const actualBuffer = Buffer.from(String(actual || ''), 'hex');

  if (!expectedBuffer.length || expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const parseLicense = raw => {
  if (!raw) {
    return {
      parsed: {},
      reason: 'missing',
    };
  }

  if (typeof raw === 'object') {
    return {
      parsed: raw,
      reason: 'parsed',
    };
  }

  try {
    return {
      parsed: JSON.parse(raw),
      reason: 'parsed',
    };
  } catch (jsonError) {
    try {
      return {
        parsed: JSON.parse(Buffer.from(raw, 'base64').toString('utf8')),
        reason: 'parsed',
      };
    } catch (base64Error) {
      return {
        parsed: {},
        reason: 'invalid_format',
      };
    }
  }
};

const allowUnsignedLicenses = () => {
  if (typeof process.env.ALLOW_UNSIGNED_LICENSES !== 'undefined') {
    return parseBoolean(process.env.ALLOW_UNSIGNED_LICENSES);
  }

  const configuredValue = config.get('allow_unsigned_licenses');

  if (typeof configuredValue !== 'undefined') {
    return parseBoolean(configuredValue);
  }

  return !productionLikeEnvironment();
};

const licenseRawValue = () => {
  if (process.env.TIMEOFF_LICENSE) {
    return {
      raw: process.env.TIMEOFF_LICENSE,
      source: 'env',
    };
  }

  const configuredLicense = config.get('license');

  if (configuredLicense) {
    return {
      raw: configuredLicense,
      source: 'config',
    };
  }

  return {
    raw: null,
    source: 'none',
  };
};

const validateLicensePayload = payload => {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      reason: 'invalid_payload',
      payload: {},
    };
  }

  if (payload.expires) {
    const expiresAt = Date.parse(payload.expires);

    if (Number.isNaN(expiresAt)) {
      return {
        valid: false,
        reason: 'invalid_expiry',
        payload,
      };
    }

    if (expiresAt < Date.now()) {
      return {
        valid: false,
        reason: 'expired',
        payload,
      };
    }
  }

  return {
    valid: true,
    reason: 'valid',
    payload,
  };
};

const verifyLicenseEnvelope = (license, source) => {
  if (!license || typeof license !== 'object') {
    return {
      valid: false,
      reason: 'missing',
      source,
      payload: {},
    };
  }

  if (!license.payload && !license.signature) {
    if (!allowUnsignedLicenses()) {
      return {
        valid: false,
        reason: 'unsigned_not_allowed',
        source,
        payload: {},
      };
    }

    return Object.assign(validateLicensePayload(license), { source });
  }

  const payload = license.payload;
  const signature = license.signature;
  const secret = getLicenseSecret();

  if (!payload || !signature || !secret) {
    return {
      valid: false,
      reason: 'missing_signature_or_secret',
      source,
      payload: payload || {},
    };
  }

  const expectedSignature = signLicensePayload(payload, secret);

  if (!signaturesMatch(expectedSignature, signature)) {
    return {
      valid: false,
      reason: 'invalid_signature',
      source,
      payload: {},
    };
  }

  return Object.assign(validateLicensePayload(payload), { source });
};

const readLicenseResult = () => {
  const licenseValue = licenseRawValue();
  const parsedLicense = parseLicense(licenseValue.raw);

  if (parsedLicense.reason === 'missing') {
    return {
      valid: false,
      reason: 'missing',
      source: licenseValue.source,
      payload: {},
    };
  }

  if (parsedLicense.reason === 'invalid_format') {
    return {
      valid: false,
      reason: 'invalid_format',
      source: licenseValue.source,
      payload: {},
    };
  }

  return verifyLicenseEnvelope(parsedLicense.parsed, licenseValue.source);
};

const readLicensePayload = () => {
  const result = readLicenseResult();

  return result.valid ? result.payload : {};
};

const getLicenseStatus = () => {
  const result = readLicenseResult();
  const payload = result.payload || {};

  return {
    valid: !!result.valid,
    reason: result.reason,
    source: result.source,
    customer: payload.customer || null,
    features: parseList(payload.features),
    expires: payload.expires || null,
  };
};

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
  registerFeature,
  allowUnlicensedFeatureOverrides,
  getLicenseStatus,
  signLicensePayload,
};
