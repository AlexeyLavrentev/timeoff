'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { importRegistry, validateEntry } = require('../../../portal/import/registry_importer');

const sha256hex = data => crypto.createHash('sha256').update(data).digest('hex');

const makeModels = () => loadPortalModels({ storage: ':memory:' });

const makeRegistryEntry = (overrides = {}) => ({
  customer: 'Test Corp',
  plan: 'pro',
  features: ['sso_authentication', 'integration_api'],
  expires: '2027-12-31',
  algorithm: 'RSA-SHA256',
  issuedAt: '2026-06-27T10:00:00.000Z',
  issuedBy: 'test-user',
  payloadHash: sha256hex('test-' + Math.random()),
  licenseHash: sha256hex('lic-' + Math.random()),
  ...overrides,
});

describe('Portal storage', function() {
  describe('model initialization', function() {
    it('creates all tables in memory SQLite', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      const tables = await models.sequelize.getQueryInterface().showAllTables();
      expect(tables).to.include('customers');
      expect(tables).to.include('plans');
      expect(tables).to.include('licenses');
      expect(tables).to.include('import_batches');
      expect(tables).to.include('audit_logs');
      expect(tables).to.include('signing_key_references');

      await models.sequelize.close();
    });

    it('creates a customer and license with association', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      const customer = await models.Customer.create({ name: 'Acme' });
      const license = await models.License.create({
        customerId: customer.id,
        features: ['sso_authentication'],
        payloadHash: sha256hex('acme-test'),
      });

      const found = await models.License.findOne({
        where: { id: license.id },
        include: [{ model: models.Customer, as: 'customer' }],
      });

      expect(found.customer.name).to.equal('Acme');

      await models.sequelize.close();
    });
  });

  describe('plan seed', function() {
    it('seeds plans from plan_presets.json', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      const results = await seedPlans(models.Plan);

      expect(results.length).to.equal(3);
      expect(results.map(r => r.name).sort()).to.deep.equal(['enterprise', 'pro', 'starter']);

      const pro = await models.Plan.findOne({ where: { name: 'pro' } });
      expect(pro.features).to.include('sso_authentication');
      expect(pro.features).to.include('integration_api');

      const enterprise = await models.Plan.findOne({ where: { name: 'enterprise' } });
      expect(enterprise.features).to.include('time_balance');

      await models.sequelize.close();
    });

    it('is idempotent (does not duplicate on re-seed)', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      await seedPlans(models.Plan);
      await seedPlans(models.Plan);

      const count = await models.Plan.count();
      expect(count).to.equal(3);

      await models.sequelize.close();
    });

    it('updates plan features on re-seed', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      await seedPlans(models.Plan);

      await models.Plan.update(
        { features: ['old_feature'] },
        { where: { name: 'pro' } }
      );

      await seedPlans(models.Plan);

      const pro = await models.Plan.findOne({ where: { name: 'pro' } });
      expect(pro.features).to.include('sso_authentication');
      expect(pro.features).to.not.include('old_feature');

      await models.sequelize.close();
    });
  });

  describe('registry import', function() {
    it('dry-run writes nothing to database', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry()];
      const result = await importRegistry(registry, models, { dryRun: true });

      expect(result.success).to.equal(true);
      expect(result.dryRun).to.equal(true);
      expect(result.importedCount).to.equal(1);

      const licenseCount = await models.License.count();
      expect(licenseCount).to.equal(0);

      const customerCount = await models.Customer.count();
      expect(customerCount).to.equal(0);

      await models.sequelize.close();
    });

    it('imports valid registry entries', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [
        makeRegistryEntry({ customer: 'Corp A', payloadHash: sha256hex('a') }),
        makeRegistryEntry({ customer: 'Corp B', payloadHash: sha256hex('b'), plan: 'enterprise' }),
      ];

      const result = await importRegistry(registry, models, { actorName: 'test' });

      expect(result.success).to.equal(true);
      expect(result.importedCount).to.equal(2);
      expect(result.skippedCount).to.equal(0);

      const licenses = await models.License.findAll();
      expect(licenses.length).to.equal(2);

      const customers = await models.Customer.findAll();
      expect(customers.length).to.equal(2);

      const batch = await models.ImportBatch.findOne();
      expect(batch).to.not.be.null;
      expect(batch.importedCount).to.equal(2);
      expect(batch.actorName).to.equal('test');

      await models.sequelize.close();
    });

    it('skips duplicate payloadHash', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const hash = sha256hex('duplicate-test');
      const registry = [
        makeRegistryEntry({ customer: 'First', payloadHash: hash }),
        makeRegistryEntry({ customer: 'Second', payloadHash: hash }),
      ];

      const result = await importRegistry(registry, models);

      expect(result.importedCount).to.equal(1);
      expect(result.skippedCount).to.equal(1);
      expect(result.details[1].status).to.equal('skipped');

      await models.sequelize.close();
    });

    it('fails on corrupt registry (non-array)', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      try {
        await importRegistry({ not: 'array' }, models);
        expect.fail('should have thrown');
      } catch (error) {
        expect(error.message).to.contain('JSON array');
      }

      await models.sequelize.close();
    });

    it('reports missing required fields', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      const registry = [
        { customer: 'No Features', payloadHash: sha256hex('x') },
      ];

      const result = await importRegistry(registry, models);

      expect(result.success).to.equal(false);
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.errors[0]).to.contain('features');

      await models.sequelize.close();
    });

    it('reports missing payloadHash', async function() {
      const models = makeModels();
      await models.sequelize.sync();

      const registry = [
        { customer: 'No Hash', features: ['sso_authentication'] },
      ];

      const result = await importRegistry(registry, models);

      expect(result.success).to.equal(false);
      expect(result.errors[0]).to.contain('payloadHash');

      await models.sequelize.close();
    });

    it('never stores private key, signature, or raw license blob', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry()];
      await importRegistry(registry, models);

      const license = await models.License.findOne();

      expect(license.licensePayload).to.be.null;

      const allData = JSON.stringify(license.toJSON());
      expect(allData).to.not.contain('PRIVATE');
      expect(allData).to.not.contain('-----BEGIN');
      expect(allData).to.not.contain('signature');

      await models.sequelize.close();
    });

    it('imported licensePayload is null (registry.json has no blobs)', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry()];
      await importRegistry(registry, models);

      const license = await models.License.findOne();
      expect(license.licensePayload).to.be.null;

      await models.sequelize.close();
    });

    it('creates customer if missing', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry({ customer: 'New Customer' })];
      await importRegistry(registry, models);

      const customer = await models.Customer.findOne({ where: { name: 'New Customer' } });
      expect(customer).to.not.be.null;

      await models.sequelize.close();
    });

    it('reuses existing customer', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      await models.Customer.create({ name: 'Existing Corp' });

      const registry = [makeRegistryEntry({ customer: 'Existing Corp', payloadHash: sha256hex('existing') })];
      await importRegistry(registry, models);

      const customers = await models.Customer.findAll({ where: { name: 'Existing Corp' } });
      expect(customers.length).to.equal(1);

      await models.sequelize.close();
    });

    it('links to plan if plan name matches preset', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry({ plan: 'pro' })];
      await importRegistry(registry, models);

      const license = await models.License.findOne({
        include: [{ model: models.Plan, as: 'plan' }],
      });

      expect(license.plan).to.not.be.null;
      expect(license.plan.name).to.equal('pro');

      await models.sequelize.close();
    });

    it('allows null plan if not in presets', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry({ plan: null, payloadHash: sha256hex('no-plan') })];
      const result = await importRegistry(registry, models);

      expect(result.success).to.equal(true);

      const license = await models.License.findOne();
      expect(license.planId).to.be.null;

      await models.sequelize.close();
    });

    it('creates audit log entries', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry()];
      await importRegistry(registry, models, { actorName: 'auditor' });

      const logs = await models.AuditLog.findAll();
      expect(logs.length).to.equal(1);
      expect(logs[0].action).to.equal('import_license');
      expect(logs[0].actorName).to.equal('auditor');
      expect(logs[0].details.customer).to.equal('Test Corp');

      await models.sequelize.close();
    });

    it('preserves issuedAt and issuedBy from registry', async function() {
      const models = makeModels();
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      const registry = [makeRegistryEntry({
        issuedAt: '2025-03-15T08:00:00.000Z',
        issuedBy: 'original-admin',
      })];
      await importRegistry(registry, models);

      const license = await models.License.findOne();
      expect(license.issuedAt.toISOString()).to.equal('2025-03-15T08:00:00.000Z');
      expect(license.actorName).to.equal('original-admin');

      await models.sequelize.close();
    });
  });

  describe('validateEntry', function() {
    it('passes valid entry', function() {
      const result = validateEntry(makeRegistryEntry(), 1);
      expect(result.valid).to.equal(true);
      expect(result.errors).to.deep.equal([]);
    });

    it('fails on null entry', function() {
      const result = validateEntry(null, 1);
      expect(result.valid).to.equal(false);
    });

    it('fails on missing customer', function() {
      const entry = makeRegistryEntry();
      delete entry.customer;
      const result = validateEntry(entry, 1);
      expect(result.valid).to.equal(false);
      expect(result.errors[0]).to.contain('customer');
    });

    it('fails on non-array features', function() {
      const entry = makeRegistryEntry({ features: 'not-array' });
      const result = validateEntry(entry, 1);
      expect(result.valid).to.equal(false);
      expect(result.errors[0]).to.contain('array');
    });
  });
});
