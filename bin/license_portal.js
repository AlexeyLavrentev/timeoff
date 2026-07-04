#!/usr/bin/env node

'use strict';

const { getPortalConfig, validateProductionConfig, ensureDbDirectory } = require('../portal/config');
const { loadPortalModels } = require('../portal/models');
const { runPortalMigrations } = require('../portal/migrator');
const { seedPlans } = require('../portal/seeders/seed_plans');
const { createSigningProvider } = require('../portal/signing/provider_factory');
const { createPortalWebApp } = require('../portal/web/app');
const { createPersistentStore } = require('../portal/auth/session_store');
const { createTrialMailer } = require('../portal/trial/mailer');

const run = async () => {
  const config = getPortalConfig();

  if (config.isProduction) {
    validateProductionConfig(config);
  }

  ensureDbDirectory(config.dbStorage);

  const models = loadPortalModels({ storage: config.dbStorage });
  const appliedMigrations = await runPortalMigrations(models);
  process.stdout.write('Portal migrations: ' + (appliedMigrations.join(', ') || 'none') + '\n');

  const seeded = await seedPlans(models.Plan);
  console.log('Plans seeded:', seeded.map(s => s.name).join(', '));

  const signingProvider = createSigningProvider(config);
  console.log('Signing provider: ' + signingProvider.getInfo().type);
  const trialMailer = createTrialMailer(config);

  let sessionStore = null;
  if (config.isProduction) {
    sessionStore = createPersistentStore(models.sequelize);
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
    trustProxy: config.trustProxy,
    nodeEnv: config.nodeEnv,
    apiEnabled: config.apiEnabled,
    trialConfig: config,
    trialMailer,
  });

  const healthRoute = require('../portal/web/health');
  app.get('/healthz', healthRoute(models));

  app.listen(config.port, config.host, () => {
    console.log(`License Portal listening on http://${config.host}:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Self-service Trial: ${config.trialEnabled ? 'enabled' : 'disabled'}`);
    if (!config.trialEnabled) {
      console.log('WARNING: Do not expose this service to the public internet.');
    }
  });
};

run().catch(error => {
  console.error('Portal startup failed:', error.message);
  process.exit(1);
});
