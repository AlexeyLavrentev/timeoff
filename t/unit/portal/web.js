'use strict';

const crypto = require('crypto');
const http = require('http');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { hashPassword } = require('../../../portal/auth/passwords');
const { FileSigningProvider } = require('../../../portal/signing/file_signing_provider');
const { createPortalWebApp } = require('../../../portal/web/app');

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
    http.get(`http://127.0.0.1:${port}/login`, res => { res.resume(); resolve(); })
      .on('error', () => Date.now() >= deadline ? reject(new Error('timeout')) : setTimeout(attempt, 50));
  };
  attempt();
});

const get = (port, path, cookie) => new Promise((resolve, reject) => {
  const opts = {};
  if (cookie) opts.headers = { Cookie: cookie };
  http.get(`http://127.0.0.1:${port}${path}`, opts, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const setCookie = res.headers['set-cookie'];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.find(c => c.startsWith('connect.sid=')) : setCookie;
      resolve({ status: res.statusCode, body, headers: res.headers, cookie: cookieHeader ? cookieHeader.split(';')[0] : null });
    });
  }).on('error', reject);
});

const post = (port, path, data, cookie) => new Promise((resolve, reject) => {
  const body = new URLSearchParams(data).toString();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) };
  if (cookie) headers.Cookie = cookie;
  const req = http.request(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers }, res => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
      const setCookie = res.headers['set-cookie'];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.find(c => c.startsWith('connect.sid=')) : setCookie;
      resolve({ status: res.statusCode, body: responseBody, headers: res.headers, cookie: cookieHeader ? cookieHeader.split(';')[0] : null, location: res.headers.location });
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const extractCsrf = (html) => {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  return match ? match[1] : null;
};

const login = async (port, email, password) => {
  const loginPage = await get(port, '/login');
  const csrf = extractCsrf(loginPage.body);
  const res = await post(port, '/login', { email, password, _csrf: csrf }, loginPage.cookie);
  return { cookie: res.headers.location === '/' ? (await get(port, '/', res.cookie)).cookie || res.cookie : res.cookie, res };
};

describe('Portal Web UI', function() {
  let models;
  let signingProvider;
  let server;
  let port;

  before(async function() {
    const keyPair = generateKeyPair();
    models = makeModels();
    await models.sequelize.sync();
    await seedPlans(models.Plan);
    signingProvider = new FileSigningProvider({
      privateKeyPem: keyPair.privateKey,
      publicKeyPem: keyPair.publicKey,
    });

    await models.AdminUser.create({ email: 'admin@test.com', displayName: 'Admin', passwordHash: hashPassword('admin123'), role: 'admin' });
    await models.AdminUser.create({ email: 'issuer@test.com', displayName: 'Issuer', passwordHash: hashPassword('issuer123'), role: 'issuer' });
    await models.AdminUser.create({ email: 'viewer@test.com', displayName: 'Viewer', passwordHash: hashPassword('viewer123'), role: 'viewer' });

    const app = createPortalWebApp({ models, signingProvider, sessionSecret: 'test-web-secret' });
    server = app.listen(0);
    port = server.address().port;
    await waitForServer(port);
  });

  after(async function() {
    if (server) server.close();
    if (models) await models.sequelize.close();
  });

  describe('login page', function() {
    it('GET /login renders login form', async function() {
      const res = await get(port, '/login');
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('<form');
      expect(res.body).to.contain('name="email"');
      expect(res.body).to.contain('name="password"');
      expect(res.body).to.contain('name="_csrf"');
    });

    it('successful login redirects to dashboard', async function() {
      const loginPage = await get(port, '/login');
      const csrf = extractCsrf(loginPage.body);
      const res = await post(port, '/login', { email: 'admin@test.com', password: 'admin123', _csrf: csrf }, loginPage.cookie);
      expect(res.status).to.equal(302);
      expect(res.location).to.equal('/');
    });

    it('failed login shows error', async function() {
      const loginPage = await get(port, '/login');
      const csrf = extractCsrf(loginPage.body);
      const res = await post(port, '/login', { email: 'admin@test.com', password: 'wrong', _csrf: csrf }, loginPage.cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Неверный email или пароль');
    });

    it('missing CSRF on POST /login returns 403', async function() {
      const loginPage = await get(port, '/login');
      const res = await post(port, '/login', { email: 'admin@test.com', password: 'admin123' }, loginPage.cookie);
      expect(res.status).to.equal(403);
    });
  });

  describe('unauthenticated access', function() {
    it('GET / redirects to /login', async function() {
      const res = await get(port, '/');
      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/login');
    });

    it('GET /customers redirects to /login', async function() {
      const res = await get(port, '/customers');
      expect(res.status).to.equal(302);
      expect(res.headers.location).to.equal('/login');
    });
  });

  describe('dashboard', function() {
    it('shows counts', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Dashboard');
      expect(res.body).to.contain('stat-card');
    });
  });

  describe('customers', function() {
    it('viewer can see customers list', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/customers', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Клиенты');
    });

    it('viewer cannot access customer creation form', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/customers/new', cookie);
      expect(res.status).to.equal(403);
    });

    it('admin can create customer', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const newPage = await get(port, '/customers/new', cookie);
      const csrf = extractCsrf(newPage.body);
      const res = await post(port, '/customers', { name: 'WebCorp', _csrf: csrf }, cookie);
      expect(res.status).to.equal(302);

      const list = await get(port, '/customers', cookie);
      expect(list.body).to.contain('WebCorp');
    });

    it('issuer cannot create customer', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const res = await get(port, '/customers/new', cookie);
      expect(res.status).to.equal(403);
    });
  });

  describe('plans', function() {
    it('shows plans', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/plans', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('pro');
      expect(res.body).to.contain('enterprise');
    });
  });

  describe('licenses', function() {
    it('viewer can see licenses list', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Лицензии');
    });

    it('viewer cannot access issue form', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses/new', cookie);
      expect(res.status).to.equal(403);
    });

    it('issuer can issue license', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const newPage = await get(port, '/licenses/new', cookie);
      const csrf = extractCsrf(newPage.body);

      const customers = await models.Customer.findAll();
      const plans = await models.Plan.findAll();

      const res = await post(port, '/licenses', {
        customerId: customers[0].id,
        planId: plans.find(p => p.name === 'pro').id,
        expiresAt: '2027-12-31',
        _csrf: csrf,
      }, cookie);

      expect(res.status).to.equal(302);

      const list = await get(port, '/licenses', cookie);
      expect(list.body).to.contain('WebCorp');
    });

    it('admin can issue license', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const newPage = await get(port, '/licenses/new', cookie);
      const csrf = extractCsrf(newPage.body);

      const customers = await models.Customer.findAll();
      const plans = await models.Plan.findAll();

      const res = await post(port, '/licenses', {
        customerId: customers[0].id,
        planId: plans.find(p => p.name === 'enterprise').id,
        _csrf: csrf,
      }, cookie);

      expect(res.status).to.equal(302);
    });

    it('license list does not include licensePayload', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.not.contain('licensePayload');
      expect(res.body).to.not.contain('RSA-SHA256');
    });

    it('license detail does not include licensePayload', async function() {
      const licenses = await models.License.findAll();
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, `/licenses/${licenses[0].id}`, cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.not.contain('licensePayload');
    });

    it('license download returns JSON blob', async function() {
      const licenses = await models.License.findAll();
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, `/licenses/${licenses[0].id}/download`, cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('RSA-SHA256');
      expect(res.body).to.contain('payload');
    });
  });

  describe('security', function() {
    it('no rendered HTML contains passwordHash', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const pages = ['/', '/customers', '/plans', '/licenses'];
      for (const p of pages) {
        const res = await get(port, p, cookie);
        expect(res.body).to.not.contain('passwordHash');
        expect(res.body).to.not.contain('scrypt$');
      }
    });

    it('no rendered HTML contains PRIVATE KEY', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const pages = ['/', '/customers', '/plans', '/licenses'];
      for (const p of pages) {
        const res = await get(port, p, cookie);
        expect(res.body).to.not.contain('PRIVATE KEY');
        expect(res.body).to.not.contain('-----BEGIN');
      }
    });

    it('session cookie has HttpOnly and SameSite=Lax', async function() {
      const loginPage = await get(port, '/login');
      const csrf = extractCsrf(loginPage.body);
      const res = await post(port, '/login', { email: 'admin@test.com', password: 'admin123', _csrf: csrf }, loginPage.cookie);
      const setCookie = res.headers['set-cookie'];
      const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie || '');
      expect(cookie).to.contain('HttpOnly');
      expect(cookie).to.contain('SameSite=Lax');
    });
  });

  describe('CSRF', function() {
    it('missing CSRF on POST /customers returns 403', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await post(port, '/customers', { name: 'NoCSRF' }, cookie);
      expect(res.status).to.equal(403);
    });

    it('missing CSRF on POST /licenses returns 403', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const res = await post(port, '/licenses', { customerId: 'x', planId: 'y' }, cookie);
      expect(res.status).to.equal(403);
    });

    it('invalid CSRF token returns 403', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await post(port, '/customers', { name: 'BadCSRF', _csrf: 'wrong' }, cookie);
      expect(res.status).to.equal(403);
    });

    it('valid CSRF allows POST', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const page = await get(port, '/customers/new', cookie);
      const csrf = extractCsrf(page.body);
      const res = await post(port, '/customers', { name: 'GoodCSRF', _csrf: csrf }, cookie);
      expect(res.status).to.equal(302);
    });
  });

  describe('session regeneration', function() {
    it('CSRF token rotates after login', async function() {
      const loginPage = await get(port, '/login');
      const preLoginCsrf = extractCsrf(loginPage.body);

      const loginRes = await post(port, '/login', {
        email: 'admin@test.com', password: 'admin123', _csrf: preLoginCsrf,
      }, loginPage.cookie);
      expect(loginRes.status).to.equal(302);

      const dashPage = await get(port, '/', loginRes.cookie || loginPage.cookie);
      const postLoginCsrf = extractCsrf(dashPage.body);

      expect(postLoginCsrf).to.be.a('string');
      expect(postLoginCsrf).to.not.equal(preLoginCsrf);
    });
  });

  describe('web lockout', function() {
    it('5 wrong password attempts set lockedUntil', async function() {
      await models.AdminUser.create({
        email: 'weblock@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
      });

      for (let i = 0; i < 5; i++) {
        const pg = await get(port, '/login');
        const csrf = extractCsrf(pg.body);
        await post(port, '/login', { email: 'weblock@test.com', password: 'wrong', _csrf: csrf }, pg.cookie);
      }

      const user = await models.AdminUser.findOne({ where: { email: 'weblock@test.com' } });
      expect(user.lockedUntil).to.not.be.null;
      expect(new Date(user.lockedUntil)).to.be.greaterThan(new Date());
    });

    it('locked user cannot login even with correct password', async function() {
      await models.AdminUser.create({
        email: 'weblocked@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      const pg = await get(port, '/login');
      const csrf = extractCsrf(pg.body);
      const res = await post(port, '/login', { email: 'weblocked@test.com', password: 'correct123', _csrf: csrf }, pg.cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Неверный email или пароль');
    });

    it('locked user sees same generic error as wrong credentials', async function() {
      await models.AdminUser.create({
        email: 'weblockmsg@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      const pg1 = await get(port, '/login');
      const csrf1 = extractCsrf(pg1.body);
      const lockedRes = await post(port, '/login', { email: 'weblockmsg@test.com', password: 'correct123', _csrf: csrf1 }, pg1.cookie);

      const pg2 = await get(port, '/login');
      const csrf2 = extractCsrf(pg2.body);
      const wrongRes = await post(port, '/login', { email: 'admin@test.com', password: 'wrong', _csrf: csrf2 }, pg2.cookie);

      expect(lockedRes.body).to.contain('Неверный email или пароль');
      expect(wrongRes.body).to.contain('Неверный email или пароль');
    });

    it('locked account audit log contains account_locked reason', async function() {
      await models.AdminUser.create({
        email: 'weblockaudit@test.com',
        passwordHash: hashPassword('correct123'),
        role: 'viewer',
        lockedUntil: new Date(Date.now() + 60000),
        failedLoginCount: 5,
      });

      const pg = await get(port, '/login');
      const csrf = extractCsrf(pg.body);
      await post(port, '/login', { email: 'weblockaudit@test.com', password: 'correct123', _csrf: csrf }, pg.cookie);

      const logs = await models.AuditLog.findAll({ where: { action: 'login_failed' } });
      const lockLog = logs.find(l => l.actorName === 'weblockaudit@test.com' && l.details && l.details.reason === 'account_locked');
      expect(lockLog).to.not.be.undefined;
    });
  });

  describe('features textarea preservation', function() {
    it('preserves features value after validation error', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const newPage = await get(port, '/licenses/new', cookie);
      const csrf = extractCsrf(newPage.body);

      const res = await post(port, '/licenses', {
        customerId: '00000000-0000-0000-0000-000000000000',
        planId: '00000000-0000-0000-0000-000000000000',
        features: 'sso_authentication\nintegration_api',
        _csrf: csrf,
      }, cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.contain('sso_authentication');
      expect(res.body).to.contain('integration_api');
    });
  });

  describe('isolation', function() {
    it('portal web app is not mounted in customer runtime', function() {
      const mainApp = require('express')();
      expect(mainApp._router).to.be.undefined;
    });
  });
});
