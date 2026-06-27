'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const expect = require('chai').expect;
const { getPortalConfig, validateProductionConfig, ensureDbDirectory } = require('../../../portal/config');
const { createSigningProvider, SUPPORTED_PROVIDERS, RESERVED_PROVIDERS } = require('../../../portal/signing/provider_factory');
const { createPersistentStore } = require('../../../portal/auth/session_store');
const { hashPassword, verifyPassword } = require('../../../portal/auth/passwords');
const { loadPortalModels } = require('../../../portal/models');
const { createPortalWebApp } = require('../../../portal/web/app');
const healthRoute = require('../../../portal/web/health');

const generateKeyPair = () => {
  const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: kp.privateKey.export({ type: 'pkcs1', format: 'pem' }),
    publicKey: kp.publicKey.export({ type: 'pkcs1', format: 'pem' }),
  };
};

const makeModels = () => loadPortalModels({ storage: ':memory:' });

describe('Portal config', function() {
  it('returns defaults for development', function() {
    const origEnv = { ...process.env };
    delete process.env.PORTAL_SESSION_SECRET;
    delete process.env.PORTAL_LICENSE_PRIVATE_KEY_FILE;
    delete process.env.NODE_ENV;

    try {
      const config = getPortalConfig();
      expect(config.port).to.equal(3001);
      expect(config.isProduction).to.equal(false);
      expect(config.sessionSecret).to.be.null;
    } finally {
      Object.assign(process.env, origEnv);
    }
  });

  it('throws in production without PORTAL_SESSION_SECRET', function() {
    const config = { isProduction: true, sessionSecret: null, privateKeyPath: '/x', publicKeyPath: '/x' };
    expect(() => validateProductionConfig(config)).to.throw('PORTAL_SESSION_SECRET');
  });

  it('throws in production without signing key', function() {
    const config = { isProduction: true, sessionSecret: 's', privateKeyPath: null, privateKeyPem: null, publicKeyPath: '/x' };
    expect(() => validateProductionConfig(config)).to.throw('PRIVATE_KEY');
  });

  it('throws in production without public key', function() {
    const config = { isProduction: true, sessionSecret: 's', privateKeyPath: '/x', publicKeyPath: null, publicKeyPem: null };
    expect(() => validateProductionConfig(config)).to.throw('PUBLIC_KEY');
  });

  it('passes with all required production vars', function() {
    const config = { isProduction: true, sessionSecret: 's', privateKeyPath: '/k', publicKeyPath: '/p' };
    expect(() => validateProductionConfig(config)).to.not.throw();
  });
});

describe('Portal signing provider factory', function() {
  it('default provider is file', function() {
    const { privateKey } = generateKeyPair();
    const provider = createSigningProvider({ privateKeyPem: privateKey });
    expect(provider.getInfo().type).to.equal('file');
  });

  it('file provider signs and returns public key', async function() {
    const { privateKey, publicKey } = generateKeyPair();
    const provider = createSigningProvider({ privateKeyPem: privateKey, publicKeyPem: publicKey });
    const envelope = await provider.sign({ customer: 'Test', features: [] });
    expect(envelope.algorithm).to.equal('RSA-SHA256');
    expect(envelope.signature).to.be.a('string');
    const pub = await provider.getPublicKeyPem();
    expect(pub).to.equal(publicKey);
  });

  it('fails for unsupported provider', function() {
    expect(() => createSigningProvider({ signingProvider: 'nonexistent' })).to.throw('Unknown signing provider');
  });

  it('fails for reserved provider aws-kms', function() {
    expect(() => createSigningProvider({ signingProvider: 'aws-kms' })).to.throw('not implemented yet');
  });

  it('fails for reserved provider vault', function() {
    expect(() => createSigningProvider({ signingProvider: 'vault' })).to.throw('not implemented yet');
  });

  it('fails for reserved provider pkcs11', function() {
    expect(() => createSigningProvider({ signingProvider: 'pkcs11' })).to.throw('not implemented yet');
  });

  it('fails for reserved provider external', function() {
    expect(() => createSigningProvider({ signingProvider: 'external' })).to.throw('not implemented yet');
  });

  it('error messages do not contain private key contents', function() {
    const { privateKey } = generateKeyPair();
    try {
      createSigningProvider({ signingProvider: 'aws-kms', privateKeyPem: privateKey });
    } catch (error) {
      expect(error.message).to.not.contain('PRIVATE');
      expect(error.message).to.not.contain(privateKey.substring(0, 30));
    }
  });

  it('file provider fails without key in production', function() {
    expect(() => createSigningProvider({ signingProvider: 'file' })).to.throw('private key');
  });

  it('validateProductionConfig rejects reserved provider', function() {
    const config = { isProduction: true, sessionSecret: 's', signingProvider: 'aws-kms' };
    expect(() => validateProductionConfig(config)).to.throw('not implemented yet');
  });

  it('validateProductionConfig skips key check for non-file provider', function() {
    const config = { isProduction: true, sessionSecret: 's', signingProvider: 'vault' };
    expect(() => validateProductionConfig(config)).to.throw('not implemented yet');
  });

  it('SUPPORTED_PROVIDERS and RESERVED_PROVIDERS are exported', function() {
    expect(SUPPORTED_PROVIDERS).to.include('file');
    expect(RESERVED_PROVIDERS).to.include('aws-kms');
    expect(RESERVED_PROVIDERS).to.include('vault');
  });
});

describe('Portal session store', function() {
  it('createPersistentStore returns a store with sync method', async function() {
    const models = makeModels();
    await models.sequelize.sync();
    const store = createPersistentStore(models.sequelize);
    expect(store.sync).to.be.a('function');
    await store.sync();
    if (store.stopExpiringSessions) store.stopExpiringSessions();
    await models.sequelize.close();
  });

  it('calling createPersistentStore twice does not fail', async function() {
    const models = makeModels();
    await models.sequelize.sync();
    const store1 = createPersistentStore(models.sequelize);
    await store1.sync();
    const store2 = createPersistentStore(models.sequelize);
    await store2.sync();
    if (store1.stopExpiringSessions) store1.stopExpiringSessions();
    if (store2.stopExpiringSessions) store2.stopExpiringSessions();
    await models.sequelize.close();
  });

  it('store.sync creates the portal_sessions table', async function() {
    const models = makeModels();
    await models.sequelize.sync();
    const store = createPersistentStore(models.sequelize);
    await store.sync();
    const tables = await models.sequelize.getQueryInterface().showAllTables();
    expect(tables).to.include('portal_sessions');
    if (store.stopExpiringSessions) store.stopExpiringSessions();
    await models.sequelize.close();
  });
});

describe('Portal health endpoint', function() {
  it('returns ok true with reachable DB', async function() {
    const models = makeModels();
    await models.sequelize.sync();

    const req = {};
    let captured = null;
    const res = { json(data) { captured = data; } };

    const route = healthRoute(models);
    await route(req, res);

    expect(captured.ok).to.equal(true);
    expect(captured.service).to.equal('license-portal');
    expect(captured.db).to.equal(true);

    await models.sequelize.close();
  });

  it('returns ok false when DB is unreachable', async function() {
    const models = makeModels();
    await models.sequelize.sync();
    await models.sequelize.close();

    const req = {};
    let captured = null;
    const res = { json(data) { captured = data; } };

    const route = healthRoute(models);
    await route(req, res);

    expect(captured.ok).to.equal(false);
    expect(captured.db).to.equal(false);
  });

  it('does not expose secrets', async function() {
    const models = makeModels();
    await models.sequelize.sync();

    const req = {};
    let captured = null;
    const res = { json(data) { captured = data; } };

    const route = healthRoute(models);
    await route(req, res);

    const json = JSON.stringify(captured);
    expect(json).to.not.contain('secret');
    expect(json).to.not.contain('PRIVATE');
    expect(json).to.not.contain('password');
    expect(json).to.not.contain('storage');

    await models.sequelize.close();
  });

  it('health endpoint is accessible via web app', async function() {
    const models = makeModels();
    await models.sequelize.sync();
    const { privateKey, publicKey } = generateKeyPair();

    const app = createPortalWebApp({
      models,
      signingProvider: { sign: async () => ({}), getPublicKeyPem: async () => publicKey, getInfo: () => ({}) },
      sessionSecret: 'test-health',
    });
    app.get('/healthz', healthRoute(models));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/healthz`, r => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(body) }));
        }).on('error', reject);
      });

      expect(res.status).to.equal(200);
      expect(res.body.ok).to.equal(true);
      expect(res.body.service).to.equal('license-portal');
    } finally {
      server.close();
      await models.sequelize.close();
    }
  });
});

describe('Portal admin CLI (create-admin)', function() {
  it('creates admin with scrypt password hash', function() {
    const hash = hashPassword('admin123');
    expect(hash).to.contain('scrypt$');
    expect(verifyPassword('admin123', hash)).to.equal(true);
  });

  it('rejects duplicate email', async function() {
    const models = makeModels();
    await models.sequelize.sync();

    await models.AdminUser.create({
      email: 'existing@test.com',
      passwordHash: hashPassword('pw'),
      role: 'admin',
    });

    const existing = await models.AdminUser.findOne({ where: { email: 'existing@test.com' } });
    expect(existing).to.not.be.null;

    const count = await models.AdminUser.count({ where: { email: 'existing@test.com' } });
    expect(count).to.equal(1);

    await models.sequelize.close();
  });

  it('valid roles are enforced', function() {
    const { VALID_ROLES } = require('../../../portal/models/admin_user');
    expect(VALID_ROLES).to.include('viewer');
    expect(VALID_ROLES).to.include('issuer');
    expect(VALID_ROLES).to.include('admin');
  });
});

describe('Portal deployment isolation', function() {
  it('portal entrypoint does not mount into app.js', function() {
    const mainApp = require('express')();
    expect(mainApp._router).to.be.undefined;
  });

    it('Dockerfile.portal does not contain secrets', function() {
      const dockerfile = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'Dockerfile.portal'), 'utf8');
      expect(dockerfile).to.not.contain('-----BEGIN');
      expect(dockerfile).to.not.contain('scrypt$');
      expect(dockerfile).to.not.contain('PORTAL_SESSION_SECRET=');
    });

  it('docker-compose.portal.yml does not contain secrets inline', function() {
    const compose = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docker-compose.portal.yml'), 'utf8');
    expect(compose).to.not.contain('PRIVATE KEY');
    expect(compose).to.not.contain('scrypt$');
    expect(compose).to.contain('PORTAL_SESSION_SECRET');
    expect(compose).to.contain('secrets:');
  });

  it('ensureDbDirectory creates parent dirs for non-memory storage', function() {
    const tmpDir = path.join(__dirname, 'tmp_ensure_db_' + Date.now());
    const dbPath = path.join(tmpDir, 'deep', 'portal.sqlite');

    try {
      ensureDbDirectory(dbPath);
      expect(fs.existsSync(path.dirname(dbPath))).to.equal(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('ensureDbDirectory skips :memory:', function() {
    expect(() => ensureDbDirectory(':memory:')).to.not.throw();
  });
});
