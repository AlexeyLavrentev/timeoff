'use strict';

const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { hashPassword, verifyPassword } = require('../../../portal/auth/passwords');

const node = process.execPath;
const binDir = path.join(__dirname, '..', '..', '..', 'bin');

const makeTempDb = (suffix) => {
  const dir = path.join(__dirname, 'tmp_admin_' + suffix + '_' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return { dir, dbPath: path.join(dir, 'portal.sqlite') };
};

const runAdmin = (args, envOverrides) => {
  return spawnSync(node, [path.join(binDir, 'portal_admin.js'), ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, envOverrides || {}),
  });
};

describe('Portal admin CLI', function() {
  describe('create', function() {
    it('creates admin from env password', function() {
      const { dir, dbPath } = makeTempDb('create');
      try {
        const result = runAdmin([
          'create',
          '--email', 'admin@test.com',
          '--password-env', 'TEST_PW',
          '--display-name', 'Test Admin',
          '--role', 'admin',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.equal(0);
        expect(result.stdout).to.contain('admin@test.com');
        expect(result.stdout).to.contain('admin');
        expect(result.stdout).to.not.contain('secure-password-1234');
        expect(result.stdout).to.not.contain('scrypt$');
        expect(result.stderr).to.not.contain('secure-password-1234');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('created user has scrypt password hash', async function() {
      const { dir, dbPath } = makeTempDb('hash');
      try {
        runAdmin([
          'create',
          '--email', 'hash@test.com',
          '--password-env', 'TEST_PW',
          '--role', 'admin',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        const models = loadPortalModels({ storage: dbPath });
        await models.sequelize.sync();
        const user = await models.AdminUser.findOne({ where: { email: 'hash@test.com' } });
        expect(user).to.not.be.null;
        expect(user.passwordHash).to.contain('scrypt$');
        expect(verifyPassword('secure-password-1234', user.passwordHash)).to.equal(true);
        await models.sequelize.close();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('duplicate email fails', function() {
      const { dir, dbPath } = makeTempDb('dupe');
      try {
        runAdmin([
          'create', '--email', 'dupe@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        const result = runAdmin([
          'create', '--email', 'dupe@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('already exists');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('missing password env fails', function() {
      const { dir, dbPath } = makeTempDb('noenv');
      try {
        const result = runAdmin([
          'create', '--email', 'noenv@test.com', '--password-env', 'NONEXISTENT_VAR',
        ], { PORTAL_DB_STORAGE: dbPath });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('not set');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('short password fails', function() {
      const { dir, dbPath } = makeTempDb('short');
      try {
        const result = runAdmin([
          'create', '--email', 'short@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'short' });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('12 characters');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('invalid role fails', function() {
      const { dir, dbPath } = makeTempDb('role');
      try {
        const result = runAdmin([
          'create', '--email', 'role@test.com', '--password-env', 'TEST_PW',
          '--role', 'superadmin',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('--role');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('missing email fails', function() {
      const { dir, dbPath } = makeTempDb('noemail');
      try {
        const result = runAdmin([
          'create', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('--email');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('password/hash is not in stdout or stderr', function() {
      const { dir, dbPath } = makeTempDb('noprint');
      try {
        const result = runAdmin([
          'create', '--email', 'noprint@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'super-secure-pw-1234' });

        expect(result.stdout).to.not.contain('super-secure-pw-1234');
        expect(result.stderr).to.not.contain('super-secure-pw-1234');
        expect(result.stdout).to.not.contain('scrypt$');
        expect(result.stderr).to.not.contain('scrypt$');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('list', function() {
    it('shows email and role but not passwordHash', function() {
      const { dir, dbPath } = makeTempDb('list');
      try {
        runAdmin([
          'create', '--email', 'list@test.com', '--password-env', 'TEST_PW', '--role', 'issuer',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        const result = runAdmin(['list'], { PORTAL_DB_STORAGE: dbPath });

        expect(result.status).to.equal(0);
        expect(result.stdout).to.contain('list@test.com');
        expect(result.stdout).to.contain('issuer');
        expect(result.stdout).to.not.contain('scrypt$');
        expect(result.stdout).to.not.contain('passwordHash');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('shows empty message when no users', function() {
      const { dir, dbPath } = makeTempDb('listempty');
      try {
        const result = runAdmin(['list'], { PORTAL_DB_STORAGE: dbPath });

        expect(result.status).to.equal(0);
        expect(result.stdout).to.contain('No admin users found');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('disable', function() {
    it('disables a user', function() {
      const { dir, dbPath } = makeTempDb('disable');
      try {
        runAdmin([
          'create', '--email', 'dis@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        const result = runAdmin([
          'disable', '--email', 'dis@test.com',
        ], { PORTAL_DB_STORAGE: dbPath });

        expect(result.status).to.equal(0);
        expect(result.stdout).to.contain('disabled');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('fails for unknown user', function() {
      const { dir, dbPath } = makeTempDb('disunknown');
      try {
        const result = runAdmin([
          'disable', '--email', 'nobody@test.com',
        ], { PORTAL_DB_STORAGE: dbPath });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('not found');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('reset-password', function() {
    it('resets password and clears lockout', function() {
      const { dir, dbPath } = makeTempDb('reset');
      try {
        runAdmin([
          'create', '--email', 'reset@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        const result = runAdmin([
          'reset-password', '--email', 'reset@test.com', '--password-env', 'NEW_PW',
        ], { PORTAL_DB_STORAGE: dbPath, NEW_PW: 'new-secure-pw-9876' });

        expect(result.status).to.equal(0);
        expect(result.stdout).to.contain('Password reset');
        expect(result.stdout).to.not.contain('new-secure-pw-9876');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('fails for unknown user', function() {
      const { dir, dbPath } = makeTempDb('resetunknown');
      try {
        const result = runAdmin([
          'reset-password', '--email', 'nobody@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.not.equal(0);
        expect(result.stderr).to.contain('not found');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('usage and error handling', function() {
    it('prints usage when no subcommand', function() {
      const result = runAdmin([], {});
      expect(result.status).to.not.equal(0);
      expect(result.stderr).to.contain('Usage');
    });

    it('prints usage for unknown subcommand', function() {
      const result = runAdmin(['unknown'], {});
      expect(result.status).to.not.equal(0);
      expect(result.stderr).to.contain('Usage');
    });

    it('password is not in process args', function() {
      const { dir, dbPath } = makeTempDb('noargs');
      try {
        const result = runAdmin([
          'create', '--email', 'args@test.com', '--password-env', 'TEST_PW',
        ], { PORTAL_DB_STORAGE: dbPath, TEST_PW: 'secure-password-1234' });

        expect(result.status).to.equal(0);
        expect(result.stderr).to.not.contain('--password secure');
        expect(result.stdout).to.not.contain('--password');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
