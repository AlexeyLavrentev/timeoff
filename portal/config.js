'use strict';

const fs = require('fs');
const path = require('path');

const getPortalConfig = () => {
  const isProduction = (process.env.NODE_ENV || '') === 'production';

  const config = {
    port: parseInt(process.env.PORTAL_PORT, 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction,

    sessionSecret: process.env.PORTAL_SESSION_SECRET || null,
    sessionSecure: process.env.PORTAL_SESSION_SECURE === 'true',

    dbStorage: process.env.PORTAL_DB_STORAGE || path.join(process.cwd(), 'data', 'portal.sqlite'),

    privateKeyPath: process.env.PORTAL_LICENSE_PRIVATE_KEY_FILE || null,
    privateKeyPem: process.env.PORTAL_LICENSE_PRIVATE_KEY || null,
    publicKeyPath: process.env.PORTAL_LICENSE_PUBLIC_KEY_FILE || null,
    publicKeyPem: process.env.PORTAL_LICENSE_PUBLIC_KEY || null,
  };

  return config;
};

const validateProductionConfig = (config) => {
  const errors = [];

  if (!config.sessionSecret) {
    errors.push('PORTAL_SESSION_SECRET is required in production');
  }

  if (!config.privateKeyPath && !config.privateKeyPem) {
    errors.push('PORTAL_LICENSE_PRIVATE_KEY_FILE or PORTAL_LICENSE_PRIVATE_KEY is required');
  }

  if (!config.publicKeyPath && !config.publicKeyPem) {
    errors.push('PORTAL_LICENSE_PUBLIC_KEY_FILE or PORTAL_LICENSE_PUBLIC_KEY is required');
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
