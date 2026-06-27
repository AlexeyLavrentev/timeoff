'use strict';

const fs = require('fs');
const path = require('path');

const getPortalConfig = () => {
  const isProduction = (process.env.NODE_ENV || '') === 'production';

  const config = {
    host: process.env.PORTAL_HOST || '127.0.0.1',
    port: parseInt(process.env.PORTAL_PORT, 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction,

    sessionSecret: process.env.PORTAL_SESSION_SECRET || null,
    sessionSecure: process.env.PORTAL_SESSION_SECURE === 'true',

    dbStorage: process.env.PORTAL_DB_STORAGE || path.join(process.cwd(), 'data', 'portal.sqlite'),

    signingProvider: process.env.PORTAL_SIGNING_PROVIDER || 'file',
    privateKeyPath: process.env.PORTAL_LICENSE_PRIVATE_KEY_FILE || null,
    privateKeyPem: process.env.PORTAL_LICENSE_PRIVATE_KEY || null,
    publicKeyPath: process.env.PORTAL_LICENSE_PUBLIC_KEY_FILE || null,
    publicKeyPem: process.env.PORTAL_LICENSE_PUBLIC_KEY || null,
  };

  return config;
};

const { SUPPORTED_PROVIDERS, RESERVED_PROVIDERS } = require('./signing/provider_factory');

const validateProductionConfig = (config) => {
  const errors = [];

  if (!config.sessionSecret) {
    errors.push('PORTAL_SESSION_SECRET is required in production');
  }

  const provider = (config.signingProvider || 'file').toLowerCase();

  if (RESERVED_PROVIDERS.includes(provider)) {
    errors.push('Signing provider "' + provider + '" is not implemented yet');
  } else if (!SUPPORTED_PROVIDERS.includes(provider)) {
    errors.push('Unknown signing provider: "' + provider + '"');
  }

  if (provider === 'file') {
    if (!config.privateKeyPath && !config.privateKeyPem) {
      errors.push('PORTAL_LICENSE_PRIVATE_KEY_FILE or PORTAL_LICENSE_PRIVATE_KEY is required');
    }

    if (!config.publicKeyPath && !config.publicKeyPem) {
      errors.push('PORTAL_LICENSE_PUBLIC_KEY_FILE or PORTAL_LICENSE_PUBLIC_KEY is required');
    }
  }

  if (errors.length > 0) {
    throw new Error('Portal production config errors:\n  ' + errors.join('\n  '));
  }
};

const ensureDbDirectory = (dbStorage) => {
  if (dbStorage && dbStorage !== ':memory:') {
    fs.mkdirSync(path.dirname(dbStorage), { recursive: true });
  }
};

module.exports = { getPortalConfig, validateProductionConfig, ensureDbDirectory };
