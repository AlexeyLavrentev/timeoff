'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { hashPassword } = require('../../../portal/auth/passwords');

const node = process.execPath;
const binDir = path.join(__dirname, '..', '..', '..', 'bin');

const makeTempDb = (suffix) => {
  const dir = path.join(__dirname, 'tmp_backup_' + suffix + '_' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return { dir, dbPath: path.join(dir, 'portal.sqlite') };
};

const sha256hex = data => crypto.createHash('sha256').update(data).digest('hex');

describe('Portal backup/restore', function() {
  it('bin/license_portal_backup.js creates a backup file', async function() {
    const { dir, dbPath } = makeTempDb('backup');
    const outDir = path.join(dir, 'backups');

    try {
      const models = loadPortalModels({ storage: dbPath });
      await models.sequelize.sync();
      await seedPlans(models.Plan);
      await models.sequelize.close();

      const result = spawnSync(node, [
        path.join(binDir, 'license_portal_backup.js'),
        '--out-dir', outDir,
      ], {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: dbPath }),
      });

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain('Backup created successfully');
      expect(result.stdout).to.not.contain('PRIVATE');
      expect(result.stdout).to.not.contain('scrypt$');
      expect(result.stdout).to.not.contain('secret');

      const files = fs.readdirSync(outDir);
      expect(files.length).to.equal(1);
      expect(files[0]).to.match(/^portal-\d{8}-\d{6}\.sqlite$/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('backup preserves portal data counts', async function() {
    const { dir, dbPath } = makeTempDb('counts');
    const backupDir = path.join(dir, 'backups');

    try {
      const models = loadPortalModels({ storage: dbPath });
      await models.sequelize.sync();
      await seedPlans(models.Plan);

      await models.AdminUser.create({
        email: 'backup@test.com',
        passwordHash: hashPassword('backup123'),
        role: 'admin',
      });
      const cust = await models.Customer.create({ name: 'BackupTest' });
      const plan = await models.Plan.findOne({ where: { name: 'pro' } });
      await models.License.create({
        customerId: cust.id,
        planId: plan.id,
        features: ['sso_authentication'],
        algorithm: 'RSA-SHA256',
        payloadHash: sha256hex('backup-payload'),
        licenseHash: sha256hex('backup-lic'),
        licensePayload: JSON.stringify({ payload: { customer: 'BackupTest' }, algorithm: 'RSA-SHA256', signature: 'x' }),
        issuedAt: new Date(),
      });
      await models.AuditLog.create({ action: 'backup_test', entityType: 'Test', details: { reason: 'test' } });

      const countsBefore = {
        adminUsers: await models.AdminUser.count(),
        customers: await models.Customer.count(),
        plans: await models.Plan.count(),
        licenses: await models.License.count(),
        auditLogs: await models.AuditLog.count(),
      };
      await models.sequelize.close();

      const result = spawnSync(node, [
        path.join(binDir, 'license_portal_backup.js'),
        '--out-dir', backupDir,
      ], {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: dbPath }),
      });

      expect(result.status).to.equal(0);

      const backupFile = path.join(backupDir, fs.readdirSync(backupDir)[0]);
      const restoredPath = path.join(dir, 'restored.sqlite');
      fs.copyFileSync(backupFile, restoredPath);

      const restored = loadPortalModels({ storage: restoredPath });
      await restored.sequelize.sync();

      const countsAfter = {
        adminUsers: await restored.AdminUser.count(),
        customers: await restored.Customer.count(),
        plans: await restored.Plan.count(),
        licenses: await restored.License.count(),
        auditLogs: await restored.AuditLog.count(),
      };

      expect(countsAfter).to.deep.equal(countsBefore);
      expect(countsAfter.adminUsers).to.be.greaterThan(0);

      const license = await restored.License.findOne();
      expect(license.payloadHash).to.equal(sha256hex('backup-payload'));
      expect(license.licenseHash).to.equal(sha256hex('backup-lic'));
      expect(license.licensePayload).to.contain('RSA-SHA256');

      await restored.sequelize.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('backup does not contain private key material', async function() {
    const { dir, dbPath } = makeTempDb('security');
    const backupDir = path.join(dir, 'backups');

    try {
      const models = loadPortalModels({ storage: dbPath });
      await models.sequelize.sync();
      await models.sequelize.close();

      const result = spawnSync(node, [
        path.join(binDir, 'license_portal_backup.js'),
        '--out-dir', backupDir,
      ], {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: dbPath }),
      });

      expect(result.status).to.equal(0);

      const backupFile = path.join(backupDir, fs.readdirSync(backupDir)[0]);
      const content = fs.readFileSync(backupFile, 'utf8');

      expect(content).to.not.contain('PRIVATE KEY');
      expect(content).to.not.contain('BEGIN RSA');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('backup script fails on missing database', function() {
    const result = spawnSync(node, [
      path.join(binDir, 'license_portal_backup.js'),
      '--out-dir', '/tmp/portal-backup-test-nonexistent',
    ], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: '/tmp/nonexistent-' + Date.now() + '.sqlite' }),
    });

    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.contain('not found');
  });

  it('backup script fails on in-memory database', function() {
    const result = spawnSync(node, [
      path.join(binDir, 'license_portal_backup.js'),
    ], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: ':memory:' }),
    });

    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.contain('in-memory');
  });

  it('backup script creates parent directory if missing', async function() {
    const { dir, dbPath } = makeTempDb('mkdir');
    const outDir = path.join(dir, 'deep', 'nested', 'backups');

    try {
      const models = loadPortalModels({ storage: dbPath });
      await models.sequelize.sync();
      await models.sequelize.close();

      const result = spawnSync(node, [
        path.join(binDir, 'license_portal_backup.js'),
        '--out-dir', outDir,
      ], {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PORTAL_DB_STORAGE: dbPath }),
      });

      expect(result.status).to.equal(0);
      expect(fs.existsSync(outDir)).to.equal(true);
      expect(fs.readdirSync(outDir).length).to.equal(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
