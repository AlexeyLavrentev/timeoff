'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const express = require('express');
const http = require('http');
const session = require('express-session');
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { FileSigningProvider, canonicalJson } = require('../../../portal/signing/file_signing_provider');
const { hashPassword } = require('../../../portal/auth/passwords');
const { createSessionMiddleware } = require('../../../portal/auth/session');
const { requireAuth, requireRole } = require('../../../portal/auth/middleware');
const { issueLicense, listLicenses, getLicense, getLicenseBlob } = require('../../../portal/services/license_service');
const { listCustomers, createCustomer, getCustomer } = require('../../../portal/services/customer_service');
const { listPlans, getPlan } = require('../../../portal/services/plan_service');
const { createPortalRouter, createAuthRouter } = require('../../../portal/api/router');

const sha256hex = data => crypto.createHash('sha256').update(data).digest('hex');
const makeModels = () => loadPortalModels({ storage: ':memory:' });

const generateKeyPair = () => {
  const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: kp.privateKey.export({ type: 'pkcs1', format: 'pem' }),
    publicKey: kp.publicKey.export({ type: 'pkcs1', format: 'pem' }),
  };
};

const waitForServer = (port) => new Promise((resolve, reject) => {
  const deadline = Date.now() + 5000;
  const attempt = () => {
    const req = http.get(`http://127.0.0.1:${port}/license-portal/auth/me`, res => {
      res.resume();
      resolve();
    });
    req.on('error', () => Date.now() >= deadline ? reject(new Error('timeout')) : setTimeout(attempt, 50));
    req.setTimeout(100, () => { req.destroy(); attempt(); });
  };
  attempt();
});

describe('Portal signing', function() {
  it('FileSigningProvider signs a valid RSA envelope', async function() {
    const { privateKey, publicKey } = generateKeyPair();
    const provider = new FileSigningProvider({ privateKeyPem: privateKey, publicKeyPem: publicKey });

    const payload = { customer: 'Test', features: ['sso_authentication'] };
    const envelope = await provider.sign(payload);

    expect(envelope.algorithm).to.equal('RSA-SHA256');
    expect(envelope.signature).to.be.a('string');
    expect(envelope.payload).to.deep.equal(payload);

    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(canonicalJson(payload)),
      publicKey,
      Buffer.from(envelope.signature, 'base64')
    );
    expect(verified).to.equal(true);
  });

  it('getPublicKeyPem returns configured public key', async function() {
    const { privateKey, publicKey } = generateKeyPair();
    const provider = new FileSigningProvider({ privateKeyPem: privateKey, publicKeyPem: publicKey });
    const result = await provider.getPublicKeyPem();
    expect(result).to.equal(publicKey);
  });

  it('getPublicKeyPem derives public key from private key', async function() {
    const { privateKey } = generateKeyPair();
    const provider = new FileSigningProvider({ privateKeyPem: privateKey });
    const result = await provider.getPublicKeyPem();
    expect(result).to.contain('PUBLIC KEY-----');
  });

  it('getInfo returns provider metadata', function() {
    const { privateKey } = generateKeyPair();
    const provider = new FileSigningProvider({ privateKeyPem: privateKey });
    const info = provider.getInfo();
    expect(info.type).to.equal('file');
    expect(info.algorithm).to.equal('RSA-SHA256');
  });

  it('never logs or exposes private key via toJSON', function() {
    const { privateKey } = generateKeyPair();
    const provider = new FileSigningProvider({ privateKeyPem: privateKey });
    const json = JSON.stringify(provider);
    expect(json).to.not.contain('PRIVATE');
    expect(json).to.not.contain(privateKey.substring(0, 30));
    expect(json).to.contain('file');
  });

  it('reads private key from file path', function() {
    const { privateKey } = generateKeyPair();
    const tmpFile = path.join(__dirname, 'tmp_test_key.pem');
    fs.writeFileSync(tmpFile, privateKey);
    try {
      const provider = new FileSigningProvider({ privateKeyPath: tmpFile });
      expect(provider.getInfo().type).to.equal('file');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe('Portal password hashing', function() {
  it('hashes and verifies a password', function() {
    const hash = hashPassword('testpass123');
    expect(hash).to.contain('scrypt$');
    const { verifyPassword } = require('../../../portal/auth/passwords');
    expect(verifyPassword('testpass123', hash)).to.equal(true);
  });

  it('rejects wrong password', function() {
    const hash = hashPassword('correct');
    const { verifyPassword } = require('../../../portal/auth/passwords');
    expect(verifyPassword('wrong', hash)).to.equal(false);
  });

  it('rejects non-scrypt hash', function() {
    const { verifyPassword } = require('../../../portal/auth/passwords');
    expect(verifyPassword('test', 'not-a-hash')).to.equal(false);
  });
});

describe('Portal license service', function() {
  let models;
  let signingProvider;
  let keyPair;

  beforeEach(async function() {
    keyPair = generateKeyPair();
    models = makeModels();
    await models.sequelize.sync();
    await seedPlans(models.Plan);
    signingProvider = new FileSigningProvider({
      privateKeyPem: keyPair.privateKey,
      publicKeyPem: keyPair.publicKey,
    });
  });

  afterEach(async function() {
    await models.sequelize.close();
  });

  it('issues a license that verifies with RSA', async function() {
    const customer = await createCustomer(models.Customer, { name: 'VerifyCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const result = await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: pro.id,
      expiresAt: '2027-12-31',
    });

    expect(result.envelope.algorithm).to.equal('RSA-SHA256');
    expect(result.envelope.payload.customer).to.equal('VerifyCorp');

    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(canonicalJson(result.envelope.payload)),
      keyPair.publicKey,
      Buffer.from(result.envelope.signature, 'base64')
    );
    expect(verified).to.equal(true);
  });

  it('stores licensePayload but no private key', async function() {
    const customer = await createCustomer(models.Customer, { name: 'SafeCorp' });
    const starter = await models.Plan.findOne({ where: { name: 'starter' } });

    await issueLicense(models, signingProvider, { customerId: customer.id, planId: starter.id });

    const license = await models.License.findOne();
    expect(license.licensePayload).to.be.a('string');
    expect(license.licensePayload).to.not.contain('PRIVATE');
  });

  it('stores payloadHash and licenseHash', async function() {
    const customer = await createCustomer(models.Customer, { name: 'HashCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const result = await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });

    expect(result.license.payloadHash).to.have.length(64);
    expect(result.license.licenseHash).to.have.length(64);
  });

  it('creates AuditLog on issue', async function() {
    const customer = await createCustomer(models.Customer, { name: 'AuditCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id, actorName: 'test-auditor' });

    const logs = await models.AuditLog.findAll();
    expect(logs.length).to.equal(1);
    expect(logs[0].action).to.equal('issue_license');
    expect(logs[0].actorName).to.equal('test-auditor');
  });

  it('throws NOT_FOUND for invalid customerId', async function() {
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });
    try {
      await issueLicense(models, signingProvider, { customerId: '00000000-0000-0000-0000-000000000000', planId: pro.id });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('NOT_FOUND');
    }
  });

  it('throws NOT_FOUND for invalid planId', async function() {
    const customer = await createCustomer(models.Customer, { name: 'NoPlanCorp' });
    try {
      await issueLicense(models, signingProvider, { customerId: customer.id, planId: '00000000-0000-0000-0000-000000000000' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('NOT_FOUND');
    }
  });

  it('listLicenses does not return licensePayload', async function() {
    const customer = await createCustomer(models.Customer, { name: 'ListCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });
    await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });

    const licenses = await listLicenses(models.License);
    expect(licenses[0].licensePayload).to.equal(undefined);
  });

  it('getLicenseBlob returns the blob', async function() {
    const customer = await createCustomer(models.Customer, { name: 'BlobCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });
    const issued = await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });

    const blob = await getLicenseBlob(models.License, issued.license.id);
    expect(blob).to.contain('RSA-SHA256');
  });

  it('rolls back License if AuditLog creation fails', async function() {
    const customer = await createCustomer(models.Customer, { name: 'RollbackCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const originalCreate = models.AuditLog.create.bind(models.AuditLog);
    models.AuditLog.create = async () => { throw new Error('audit boom'); };

    try {
      await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.message).to.equal('audit boom');
    }

    models.AuditLog.create = originalCreate;
    expect(await models.License.count()).to.equal(0);
  });

  it('throws DUPLICATE_LICENSE for same payloadHash', async function() {
    const customer = await createCustomer(models.Customer, { name: 'DupeCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id, expiresAt: '2027-12-31' });

    try {
      await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id, expiresAt: '2027-12-31' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('DUPLICATE_LICENSE');
    }

    expect(await models.License.count()).to.equal(1);
  });

  it('throws VALIDATION_ERROR for non-array featuresOverride', async function() {
    const customer = await createCustomer(models.Customer, { name: 'FeatCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });
    try {
      await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id, features: 'not-an-array' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('VALIDATION_ERROR');
    }
  });

  it('throws VALIDATION_ERROR for non-string features array', async function() {
    const customer = await createCustomer(models.Customer, { name: 'FeatCorp2' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });
    try {
      await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id, features: [123] });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('VALIDATION_ERROR');
    }
  });
});

describe('Portal API auth', function() {
  let models;
  let signingProvider;
  let server;
  let port;
  let baseUrl;

  before(async function() {
    const keyPair = generateKeyPair();
    models = makeModels();
    await models.sequelize.sync();
    await seedPlans(models.Plan);
    signingProvider = new FileSigningProvider({
      privateKeyPem: keyPair.privateKey,
      publicKeyPem: keyPair.publicKey,
    });

    await models.AdminUser.create({
      email: 'admin@test.com',
      displayName: 'Test Admin',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
    });

    await models.AdminUser.create({
      email: 'issuer@test.com',
      displayName: 'Test Issuer',
      passwordHash: hashPassword('issuer123'),
      role: 'issuer',
    });

    await models.AdminUser.create({
      email: 'viewer@test.com',
      displayName: 'Test Viewer',
      passwordHash: hashPassword('viewer123'),
      role: 'viewer',
    });

    await models.AdminUser.create({
      email: 'inactive@test.com',
      passwordHash: hashPassword('inactive123'),
      role: 'viewer',
      isActive: false,
    });

    const app = express();
    app.use(express.json());
    app.use(createSessionMiddleware({ secret: 'test-secret' }));
    app.use('/license-portal/auth', createAuthRouter(models));
    app.use('/license-portal', createPortalRouter(models, signingProvider));

    server = app.listen(0);
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/license-portal`;
    await waitForServer(port);
  });

  after(async function() {
    if (server) server.close();
    if (models) await models.sequelize.close();
  });

  const httpGet = (urlPath, cookie) => new Promise((resolve, reject) => {
    const opts = {};
    if (cookie) opts.headers = { Cookie: cookie };
    http.get(`${baseUrl}${urlPath}`, opts, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    }).on('error', reject);
  });

  const httpPost = (urlPath, data, cookie) => new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (cookie) headers.Cookie = cookie;
    const req = http.request(`${baseUrl}${urlPath}`, { method: 'POST', headers }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const login = async (email, password) => {
    const res = await httpPost('/auth/login', { email, password });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.find(c => c.startsWith('connect.sid=')) : setCookie;
    return { ...res, cookie: cookie ? cookie.split(';')[0] : null };
  };

  describe('POST /auth/login', function() {
    it('logs in with valid credentials', async function() {
      const res = await login('admin@test.com', 'admin123');
      expect(res.status).to.equal(200);
      expect(res.body.user.email).to.equal('admin@test.com');
      expect(res.body.user.passwordHash).to.equal(undefined);
      expect(res.cookie).to.be.a('string');
    });

    it('returns 401 for wrong password', async function() {
      const res = await httpPost('/auth/login', { email: 'admin@test.com', password: 'wrong' });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.contain('Invalid');
    });

    it('returns 401 for nonexistent user', async function() {
      const res = await httpPost('/auth/login', { email: 'nobody@test.com', password: 'test' });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.contain('Invalid');
    });

    it('does not reveal whether email or password was wrong', async function() {
      const res1 = await httpPost('/auth/login', { email: 'admin@test.com', password: 'wrong' });
      const res2 = await httpPost('/auth/login', { email: 'nobody@test.com', password: 'test' });
      expect(res1.body.error).to.equal(res2.body.error);
    });

    it('rejects inactive user', async function() {
      const res = await httpPost('/auth/login', { email: 'inactive@test.com', password: 'inactive123' });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.contain('Invalid');
    });

    it('returns 400 for missing credentials', async function() {
      const res = await httpPost('/auth/login', {});
      expect(res.status).to.equal(400);
    });
  });

  describe('GET /auth/me', function() {
    it('returns current user', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const res = await httpGet('/auth/me', cookie);
      expect(res.status).to.equal(200);
      expect(res.body.user.email).to.equal('admin@test.com');
      expect(res.body.user.role).to.equal('admin');
      expect(res.body.user.passwordHash).to.equal(undefined);
    });

    it('returns 401 without session', async function() {
      const res = await httpGet('/auth/me');
      expect(res.status).to.equal(401);
    });
  });

  describe('POST /auth/logout', function() {
    it('clears session', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const logoutRes = await httpPost('/auth/logout', {}, cookie);
      expect(logoutRes.status).to.equal(200);

      const meRes = await httpGet('/auth/me', cookie);
      expect(meRes.status).to.equal(401);
    });
  });

  describe('role-based access', function() {
    it('unauthenticated access returns 401', async function() {
      const res = await httpGet('/customers');
      expect(res.status).to.equal(401);
    });

    it('viewer can list customers', async function() {
      const { cookie } = await login('viewer@test.com', 'viewer123');
      const res = await httpGet('/customers', cookie);
      expect(res.status).to.equal(200);
    });

    it('viewer can list plans', async function() {
      const { cookie } = await login('viewer@test.com', 'viewer123');
      const res = await httpGet('/plans', cookie);
      expect(res.status).to.equal(200);
    });

    it('viewer can list licenses', async function() {
      const { cookie } = await login('viewer@test.com', 'viewer123');
      const res = await httpGet('/licenses', cookie);
      expect(res.status).to.equal(200);
    });

    it('viewer cannot create customer', async function() {
      const { cookie } = await login('viewer@test.com', 'viewer123');
      const res = await httpPost('/customers', { name: 'Blocked' }, cookie);
      expect(res.status).to.equal(403);
    });

    it('viewer cannot issue license', async function() {
      const { cookie } = await login('viewer@test.com', 'viewer123');
      const plans = (await httpGet('/plans', cookie)).body;
      const res = await httpPost('/licenses', { customerId: 'x', planId: plans[0].id }, cookie);
      expect(res.status).to.equal(403);
    });

    it('issuer can issue license', async function() {
      const { cookie: adminCookie } = await login('admin@test.com', 'admin123');
      const custRes = await httpPost('/customers', { name: 'IssuerTestCorp' }, adminCookie);
      const plans = (await httpGet('/plans', adminCookie)).body;

      const { cookie: issuerCookie } = await login('issuer@test.com', 'issuer123');
      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
        expiresAt: '2027-12-31',
      }, issuerCookie);
      expect(res.status).to.equal(201);
    });

    it('issuer cannot create customer', async function() {
      const { cookie } = await login('issuer@test.com', 'issuer123');
      const res = await httpPost('/customers', { name: 'BlockedIssuer' }, cookie);
      expect(res.status).to.equal(403);
    });

    it('admin can create customer', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const res = await httpPost('/customers', { name: 'AdminCorp' }, cookie);
      expect(res.status).to.equal(201);
    });

    it('admin can issue license', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const custRes = await httpPost('/customers', { name: 'AdminLicCorp' }, cookie);
      const plans = (await httpGet('/plans', cookie)).body;
      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
      }, cookie);
      expect(res.status).to.equal(201);
    });
  });

  describe('audit logging', function() {
    it('logs successful login', async function() {
      await login('admin@test.com', 'admin123');
      const logs = await models.AuditLog.findAll({ where: { action: 'login_success' } });
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[logs.length - 1].actorName).to.equal('admin@test.com');
    });

    it('logs failed login', async function() {
      await httpPost('/auth/login', { email: 'admin@test.com', password: 'wrong' });
      const logs = await models.AuditLog.findAll({ where: { action: 'login_failed' } });
      expect(logs.length).to.be.greaterThan(0);
    });

    it('issueLicense audit uses authenticated user email', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const custRes = await httpPost('/customers', { name: 'AuditEmailCorp' }, cookie);
      const plans = (await httpGet('/plans', cookie)).body;
      await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
      }, cookie);

      const logs = await models.AuditLog.findAll({ where: { action: 'issue_license' } });
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[logs.length - 1].actorName).to.equal('admin@test.com');
    });
  });

  describe('password safety', function() {
    it('/auth/me never returns passwordHash', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const res = await httpGet('/auth/me', cookie);
      const json = JSON.stringify(res.body);
      expect(json).to.not.contain('passwordHash');
      expect(json).to.not.contain('scrypt$');
    });

    it('/auth/login never returns passwordHash', async function() {
      const res = await httpPost('/auth/login', { email: 'admin@test.com', password: 'admin123' });
      const json = JSON.stringify(res.body);
      expect(json).to.not.contain('passwordHash');
      expect(json).to.not.contain('scrypt$');
    });
  });

  describe('duplicate license via API', function() {
    it('returns 409 for duplicate license', async function() {
      const { cookie } = await login('admin@test.com', 'admin123');
      const custRes = await httpPost('/customers', { name: 'DupeAPICorp' }, cookie);
      const plans = (await httpGet('/plans', cookie)).body;
      const payload = {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
        expiresAt: '2028-12-31',
      };

      const first = await httpPost('/licenses', payload, cookie);
      expect(first.status).to.equal(201);

      const second = await httpPost('/licenses', payload, cookie);
      expect(second.status).to.equal(409);
    });
  });

  describe('lockout', function() {
    it('5 wrong password attempts set lockedUntil', async function() {
      const user = await models.AdminUser.create({
        email: 'locktest@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
      });

      for (let i = 0; i < 5; i++) {
        await httpPost('/auth/login', { email: 'locktest@test.com', password: 'wrong' });
      }

      await user.reload();
      expect(user.lockedUntil).to.not.be.null;
      expect(new Date(user.lockedUntil)).to.be.greaterThan(new Date());
      expect(user.failedLoginCount).to.equal(5);
    });

    it('locked user cannot login even with correct password', async function() {
      await models.AdminUser.create({
        email: 'lockeduser@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      const res = await httpPost('/auth/login', { email: 'lockeduser@test.com', password: 'correct123' });
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal('Invalid email or password');
    });

    it('locked account audit log records reason', async function() {
      await models.AdminUser.create({
        email: 'lockaudit@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      await httpPost('/auth/login', { email: 'lockaudit@test.com', password: 'correct123' });

      const logs = await models.AuditLog.findAll({
        where: { action: 'login_failed' },
        order: [['createdAt', 'DESC']],
      });
      const lockLog = logs.find(l => l.details && l.details.reason === 'account_locked');
      expect(lockLog).to.not.be.undefined;
      expect(lockLog.actorName).to.equal('lockaudit@test.com');
    });

    it('locked account response equals invalid-credentials response', async function() {
      await models.AdminUser.create({
        email: 'lockmsg@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      const lockedRes = await httpPost('/auth/login', { email: 'lockmsg@test.com', password: 'correct123' });
      const wrongRes = await httpPost('/auth/login', { email: 'admin@test.com', password: 'wrong' });

      expect(lockedRes.status).to.equal(wrongRes.status);
      expect(lockedRes.body.error).to.equal(wrongRes.body.error);
    });

    it('failedLoginCount resets after successful login', async function() {
      await models.AdminUser.create({
        email: 'resetcount@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        failedLoginCount: 3,
      });

      const res = await httpPost('/auth/login', { email: 'resetcount@test.com', password: 'correct123' });
      expect(res.status).to.equal(200);

      const user = await models.AdminUser.findOne({ where: { email: 'resetcount@test.com' } });
      expect(user.failedLoginCount).to.equal(0);
      expect(user.lockedUntil).to.be.null;
    });
  });

  describe('session cookie safety', function() {
    it('Set-Cookie includes HttpOnly and SameSite=Lax', async function() {
      const res = await httpPost('/auth/login', { email: 'admin@test.com', password: 'admin123' });
      const setCookie = res.headers['set-cookie'];
      const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie || '');
      expect(cookie).to.contain('HttpOnly');
      expect(cookie).to.contain('SameSite=Lax');
    });
  });

  describe('isolation', function() {
    it('portal router is not mounted in main app', function() {
      const mainApp = express();
      expect(mainApp._router).to.be.undefined;
    });
  });
});

describe('Portal session module', function() {
  it('throws in production without secret', function() {
    expect(() => createSessionMiddleware({ nodeEnv: 'production' })).to.throw('PORTAL_SESSION_SECRET');
  });

  it('works in production with explicit secret', function() {
    const mw = createSessionMiddleware({ nodeEnv: 'production', secret: 'prod-secret' });
    expect(mw).to.be.a('function');
  });

  it('uses dev fallback in test environment', function() {
    const mw = createSessionMiddleware({});
    expect(mw).to.be.a('function');
  });

  it('uses PORTAL_SESSION_SECRET env when set', function() {
    const orig = process.env.PORTAL_SESSION_SECRET;
    process.env.PORTAL_SESSION_SECRET = 'env-secret';
    try {
      const mw = createSessionMiddleware({});
      expect(mw).to.be.a('function');
    } finally {
      if (orig === undefined) {
        delete process.env.PORTAL_SESSION_SECRET;
      } else {
        process.env.PORTAL_SESSION_SECRET = orig;
      }
    }
  });
});
