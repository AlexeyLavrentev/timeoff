#!/usr/bin/env node

'use strict';

const path = require('path');
const { getPortalConfig, validateProductionConfig, ensureDbDirectory } = require('../portal/config');
const { loadPortalModels } = require('../portal/models');
const { seedPlans } = require('../portal/seeders/seed_plans');
const { FileSigningProvider } = require('../portal/signing/file_signing_provider');
const { createPortalWebApp } = require('../portal/web/app');
const { createPersistentStore } = require('../portal/auth/session_store');

const run = async () => {
  const config = getPortalConfig();

  if (config.isProduction) {
    validateProductionConfig(config);
  }

  ensureDbDirectory(config.dbStorage);

  const models = loadPortalModels({ storage: config.dbStorage });
  await models.sequelize.sync();

  const seeded = await seedPlans(models.Plan);
  console.log('Plans seeded:', seeded.map(s => s.name).join(', '));

  const signingProvider = new FileSigningProvider({
    privateKeyPath: config.privateKeyPath,
    privateKeyPem: config.privateKeyPem,
    publicKeyPath: config.publicKeyPath,
    publicKeyPem: config.publicKeyPem,
  });

  let sessionStore = null;
  if (config.isProduction) {
    sessionStore = createPersistentStore(models.sequelize);
    await sessionStore.sync();
    console.log('Session store: persistent (database)');
  } else {
    console.log('Session store: memory (dev/test only)');
  }

  const app = createPortalWebApp({
    models,
    signingProvider,
    sessionSecret: config.sessionSecret || 'portal-dev-secret',
    sessionStore,
    secure: config.sessionSecure,
  });

  const healthRoute = require('../portal/web/health');
  app.get('/healthz', healthRoute(models));

  app.listen(config.port, config.host, () => {
    console.log(`License Portal listening on http://${config.host}:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log('WARNING: Do not expose this service to the public internet.');
  });
};

run().catch(error => {
  console.error('Portal startup failed:', error.message);
  process.exit(1);
});
