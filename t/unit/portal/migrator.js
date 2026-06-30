'use strict';

const crypto = require('crypto');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { runPortalMigrations, META_TABLE } = require('../../../portal/migrator');
const { createPersistentStore } = require('../../../portal/auth/session_store');
const { hashPassword } = require('../../../portal/auth/passwords');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

describe('Portal migrator', function() {
  it('creates the complete current schema on a fresh database', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    try {
      const applied = await runPortalMigrations(models);
      expect(applied).to.deep.equal([
        '001-initial-schema.js',
        '002-license-metadata.js',
        '003-admin-auth-revision.js',
      ]);

      const tables = await models.sequelize.getQueryInterface().showAllTables();
      [
        'admin_users', 'audit_logs', 'customers', 'import_batches', 'licenses',
        'plans', 'portal_sessions', 'signing_key_references', META_TABLE,
      ].forEach(table => expect(tables).to.include(table));

      const licenseColumns = await models.sequelize.getQueryInterface().describeTable('licenses');
      expect(licenseColumns.metadata).to.not.equal(undefined);
    } finally {
      await models.sequelize.close();
    }
  });

  it('upgrades a pre-metadata schema and is a no-op on rerun', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    try {
      await models.sequelize.sync();
      await models.sequelize.getQueryInterface().removeColumn('licenses', 'metadata');

      const first = await runPortalMigrations(models);
      const second = await runPortalMigrations(models);
      const columns = await models.sequelize.getQueryInterface().describeTable('licenses');

      expect(first).to.deep.equal([
        '001-initial-schema.js',
        '002-license-metadata.js',
        '003-admin-auth-revision.js',
      ]);
      expect(second).to.deep.equal([]);
      expect(columns.metadata).to.not.equal(undefined);
    } finally {
      await models.sequelize.close();
    }
  });

  it('preserves legacy rows, hashes, lifecycle metadata, admin and session data', async function() {
    const models = loadPortalModels({ storage: ':memory:' });
    try {
      await models.sequelize.sync();
      const store = createPersistentStore(models.sequelize);
      await store.sync();
      store.stopExpiringSessions();

      const admin = await models.AdminUser.create({
        email: 'legacy-admin@example.com',
        passwordHash: hashPassword('legacy-password'),
        role: 'admin',
      });
      const customer = await models.Customer.create({ name: 'Legacy Customer' });
      const plan = await models.Plan.create({ name: 'legacy-plan', features: ['sso_authentication'] });
      const metadata = {
        seats: 42,
        customerDomains: ['legacy.example'],
        issueReason: 'replacement',
        replacementOfLicenseId: '11111111-1111-4111-8111-111111111111',
        lifecycleNote: 'Preserve exactly',
      };
      const payloadHash = sha256('legacy-payload');
      const licenseHash = sha256('legacy-license');
      await models.License.create({
        customerId: customer.id,
        planId: plan.id,
        features: ['sso_authentication'],
        payloadHash,
        licenseHash,
        licensePayload: JSON.stringify({ payload: { customer: customer.name }, signature: 'safe-fixture' }),
        issuedAt: new Date('2026-06-28T00:00:00Z'),
        metadata,
      });
      await models.AuditLog.create({ action: 'legacy_seed', entityType: 'License' });
      await models.sequelize.query(
        'INSERT INTO portal_sessions (sid, expires, data) VALUES (?, ?, ?)',
        { replacements: ['legacy-session', new Date('2030-01-01T00:00:00Z'), JSON.stringify({ userId: admin.id })] }
      );

      const before = {
        admins: await models.AdminUser.count(),
        customers: await models.Customer.count(),
        licenses: await models.License.count(),
        audits: await models.AuditLog.count(),
        metadata: JSON.stringify((await models.License.findOne()).metadata),
      };

      await runPortalMigrations(models);

      const license = await models.License.findOne();
      const sessionRows = await models.sequelize.query(
        'SELECT sid, data FROM portal_sessions WHERE sid = ?',
        { replacements: ['legacy-session'], type: models.Sequelize.QueryTypes.SELECT }
      );
      const after = {
        admins: await models.AdminUser.count(),
        customers: await models.Customer.count(),
        licenses: await models.License.count(),
        audits: await models.AuditLog.count(),
        metadata: JSON.stringify(license.metadata),
      };

      expect(after).to.deep.equal(before);
      expect(license.payloadHash).to.equal(payloadHash);
      expect(license.licenseHash).to.equal(licenseHash);
      expect(sessionRows).to.have.length(1);
      expect(JSON.parse(sessionRows[0].data).userId).to.equal(admin.id);
    } finally {
      await models.sequelize.close();
    }
  });

  it('keeps production and operations entrypoints free of schema sync', function() {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..', '..');
    ['bin/license_portal.js', 'bin/portal_admin.js', 'bin/import-registry.js'].forEach(relative => {
      const source = fs.readFileSync(path.join(root, relative), 'utf8');
      expect(source).to.not.match(/sequelize\.sync\s*\(/);
      expect(source).to.not.contain('runSchemaMaintenance');
    });
  });
});
