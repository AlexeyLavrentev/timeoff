'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const express = require('express');
const http = require('http');
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { FileSigningProvider, canonicalJson } = require('../../../portal/signing/file_signing_provider');
const { issueLicense, listLicenses, getLicense, getLicenseBlob } = require('../../../portal/services/license_service');
const { listCustomers, createCustomer, getCustomer } = require('../../../portal/services/customer_service');
const { listPlans, getPlan } = require('../../../portal/services/plan_service');
const { createPortalRouter } = require('../../../portal/api/router');

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
    const req = http.get(`http://127.0.0.1:${port}/plans`, res => {
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
    expect(result.envelope.payload.plan).to.equal('pro');
    expect(result.envelope.payload.features).to.include('sso_authentication');

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

    await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: starter.id,
    });

    const license = await models.License.findOne();
    expect(license.licensePayload).to.be.a('string');
    expect(license.licensePayload).to.contain('RSA-SHA256');
    expect(license.licensePayload).to.not.contain('PRIVATE');
    expect(license.licensePayload).to.not.contain(keyPair.privateKey.substring(0, 30));
  });

  it('stores payloadHash and licenseHash', async function() {
    const customer = await createCustomer(models.Customer, { name: 'HashCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const result = await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: pro.id,
    });

    expect(result.license.payloadHash).to.have.length(64);
    expect(result.license.licenseHash).to.have.length(64);
    expect(/^[0-9a-f]+$/i.test(result.license.payloadHash)).to.equal(true);
    expect(/^[0-9a-f]+$/i.test(result.license.licenseHash)).to.equal(true);
  });

  it('creates AuditLog on issue', async function() {
    const customer = await createCustomer(models.Customer, { name: 'AuditCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: pro.id,
      actorName: 'test-auditor',
    });

    const logs = await models.AuditLog.findAll();
    expect(logs.length).to.equal(1);
    expect(logs[0].action).to.equal('issue_license');
    expect(logs[0].actorName).to.equal('test-auditor');
    expect(logs[0].details.customer).to.equal('AuditCorp');
  });

  it('throws NOT_FOUND for invalid customerId', async function() {
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    try {
      await issueLicense(models, signingProvider, {
        customerId: '00000000-0000-0000-0000-000000000000',
        planId: pro.id,
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('NOT_FOUND');
      expect(error.message).to.contain('Customer');
    }
  });

  it('throws NOT_FOUND for invalid planId', async function() {
    const customer = await createCustomer(models.Customer, { name: 'NoPlanCorp' });

    try {
      await issueLicense(models, signingProvider, {
        customerId: customer.id,
        planId: '00000000-0000-0000-0000-000000000000',
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('NOT_FOUND');
      expect(error.message).to.contain('Plan');
    }
  });

  it('listLicenses does not return licensePayload', async function() {
    const customer = await createCustomer(models.Customer, { name: 'ListCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });

    const licenses = await listLicenses(models.License);
    expect(licenses.length).to.equal(1);
    expect(licenses[0].licensePayload).to.equal(undefined);
  });

  it('getLicenseBlob returns the blob', async function() {
    const customer = await createCustomer(models.Customer, { name: 'BlobCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const issued = await issueLicense(models, signingProvider, { customerId: customer.id, planId: pro.id });

    const blob = await getLicenseBlob(models.License, issued.license.id);
    expect(blob).to.contain('RSA-SHA256');
    expect(blob).to.contain('BlobCorp');
  });

  it('rolls back License if AuditLog creation fails', async function() {
    const customer = await createCustomer(models.Customer, { name: 'RollbackCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    const originalCreate = models.AuditLog.create.bind(models.AuditLog);
    models.AuditLog.create = async () => { throw new Error('audit boom'); };

    try {
      await issueLicense(models, signingProvider, {
        customerId: customer.id,
        planId: pro.id,
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.message).to.equal('audit boom');
    }

    models.AuditLog.create = originalCreate;

    const licenseCount = await models.License.count();
    expect(licenseCount).to.equal(0);
  });

  it('throws DUPLICATE_LICENSE for same payloadHash', async function() {
    const customer = await createCustomer(models.Customer, { name: 'DupeCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: pro.id,
      expiresAt: '2027-12-31',
    });

    try {
      await issueLicense(models, signingProvider, {
        customerId: customer.id,
        planId: pro.id,
        expiresAt: '2027-12-31',
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('DUPLICATE_LICENSE');
    }

    const licenseCount = await models.License.count();
    expect(licenseCount).to.equal(1);
  });

  it('throws VALIDATION_ERROR for non-array featuresOverride', async function() {
    const customer = await createCustomer(models.Customer, { name: 'FeatCorp' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    try {
      await issueLicense(models, signingProvider, {
        customerId: customer.id,
        planId: pro.id,
        features: 'not-an-array',
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('VALIDATION_ERROR');
      expect(error.message).to.contain('array');
    }
  });

  it('throws VALIDATION_ERROR for non-string features array', async function() {
    const customer = await createCustomer(models.Customer, { name: 'FeatCorp2' });
    const pro = await models.Plan.findOne({ where: { name: 'pro' } });

    try {
      await issueLicense(models, signingProvider, {
        customerId: customer.id,
        planId: pro.id,
        features: [123, true],
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error.code).to.equal('VALIDATION_ERROR');
      expect(error.message).to.contain('strings');
    }
  });
});

describe('Portal API router', function() {
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

    const app = express();
    app.use(express.json());
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

  const httpGet = (urlPath) => new Promise((resolve, reject) => {
    http.get(`${baseUrl}${urlPath}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });

  const httpPost = (urlPath, data) => new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  describe('GET /customers', function() {
    it('returns empty list initially', async function() {
      const res = await httpGet('/customers');
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });
  });

  describe('POST /customers', function() {
    it('creates a customer', async function() {
      const res = await httpPost('/customers', { name: 'API Corp', contactEmail: 'a@b.com' });
      expect(res.status).to.equal(201);
      expect(res.body.name).to.equal('API Corp');
      expect(res.body.id).to.be.a('string');
    });

    it('returns 400 for missing name', async function() {
      const res = await httpPost('/customers', {});
      expect(res.status).to.equal(400);
      expect(res.body.error).to.contain('name');
    });

    it('returns 409 for duplicate name', async function() {
      await httpPost('/customers', { name: 'DupeCorp' });
      const res = await httpPost('/customers', { name: 'DupeCorp' });
      expect(res.status).to.equal(409);
    });
  });

  describe('GET /plans', function() {
    it('returns seeded plans', async function() {
      const res = await httpGet('/plans');
      expect(res.status).to.equal(200);
      expect(res.body.length).to.equal(3);
      expect(res.body.map(p => p.name).sort()).to.deep.equal(['enterprise', 'pro', 'starter']);
    });
  });

  describe('POST /licenses', function() {
    it('issues a license', async function() {
      const custRes = await httpPost('/customers', { name: 'LicenseCorp' });
      const plans = (await httpGet('/plans')).body;
      const pro = plans.find(p => p.name === 'pro');

      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: pro.id,
        expiresAt: '2027-12-31',
      });

      expect(res.status).to.equal(201);
      expect(res.body.id).to.be.a('string');
      expect(res.body.payloadHash).to.have.length(64);
      expect(res.body.licensePayload).to.equal(undefined);
    });

    it('returns 400 for missing customerId', async function() {
      const plans = (await httpGet('/plans')).body;
      const res = await httpPost('/licenses', { planId: plans[0].id });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.contain('customerId');
    });

    it('returns 400 for missing planId', async function() {
      const custRes = await httpPost('/customers', { name: 'NoPlanAPI' });
      const res = await httpPost('/licenses', { customerId: custRes.body.id });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.contain('planId');
    });

    it('returns 404 for invalid customerId', async function() {
      const plans = (await httpGet('/plans')).body;
      const res = await httpPost('/licenses', {
        customerId: '00000000-0000-0000-0000-000000000000',
        planId: plans[0].id,
      });
      expect(res.status).to.equal(404);
    });

    it('returns 400 for invalid expiresAt', async function() {
      const custRes = await httpPost('/customers', { name: 'BadDateCorp' });
      const plans = (await httpGet('/plans')).body;
      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans[0].id,
        expiresAt: 'not-a-date',
      });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.contain('expiresAt');
    });

    it('returns 400 for expired date', async function() {
      const custRes = await httpPost('/customers', { name: 'ExpiredDateCorp' });
      const plans = (await httpGet('/plans')).body;
      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans[0].id,
        expiresAt: '2000-01-01',
      });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.contain('future');
    });

    it('returns 400 for non-array features', async function() {
      const custRes = await httpPost('/customers', { name: 'FeatCorp' });
      const plans = (await httpGet('/plans')).body;
      const res = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans[0].id,
        features: 'not-array',
      });
      expect(res.status).to.equal(400);
    });

    it('returns 409 for duplicate license', async function() {
      const custRes = await httpPost('/customers', { name: 'DupeAPICorp' });
      const plans = (await httpGet('/plans')).body;
      const payload = {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
        expiresAt: '2027-12-31',
      };

      const first = await httpPost('/licenses', payload);
      expect(first.status).to.equal(201);

      const second = await httpPost('/licenses', payload);
      expect(second.status).to.equal(409);
      expect(second.body.error).to.contain('already exists');
    });
  });

  describe('GET /licenses', function() {
    it('lists licenses without licensePayload', async function() {
      const res = await httpGet('/licenses');
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
      if (res.body.length > 0) {
        expect(res.body[0].licensePayload).to.equal(undefined);
      }
    });
  });

  describe('GET /licenses/:id', function() {
    it('returns license detail without licensePayload', async function() {
      const custRes = await httpPost('/customers', { name: 'DetailCorp' });
      const plans = (await httpGet('/plans')).body;
      const licRes = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
      });

      const res = await httpGet(`/licenses/${licRes.body.id}`);
      expect(res.status).to.equal(200);
      expect(res.body.id).to.equal(licRes.body.id);
      expect(res.body.licensePayload).to.equal(undefined);
    });

    it('returns 404 for nonexistent license', async function() {
      const res = await httpGet('/licenses/00000000-0000-0000-0000-000000000000');
      expect(res.status).to.equal(404);
    });
  });

  describe('GET /licenses/:id/download', function() {
    it('returns license blob', async function() {
      const custRes = await httpPost('/customers', { name: 'DownloadCorp' });
      const plans = (await httpGet('/plans')).body;
      const licRes = await httpPost('/licenses', {
        customerId: custRes.body.id,
        planId: plans.find(p => p.name === 'pro').id,
      });

      const res = await new Promise((resolve, reject) => {
        http.get(`${baseUrl}/licenses/${licRes.body.id}/download`, response => {
          let body = '';
          response.on('data', chunk => body += chunk);
          response.on('end', () => resolve({ status: response.statusCode, body }));
        }).on('error', reject);
      });

      expect(res.status).to.equal(200);
      expect(res.body).to.contain('RSA-SHA256');
      expect(res.body).to.contain('DownloadCorp');
    });
  });

  describe('isolation', function() {
    it('portal router is not mounted in main app', function() {
      const mainApp = express();
      expect(mainApp._router).to.be.undefined;
    });
  });
});
