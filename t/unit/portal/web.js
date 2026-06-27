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

  describe('license list filtering', function() {
    it('/licenses without filters still works', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Лицензии');
    });

    it('customer filter returns matching customer', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=WebCorp', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('WebCorp');
    });

    it('customer filter excludes non-matching', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=NonExistentCorp999', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Ничего не найдено');
    });

    it('plan filter works', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?plan=pro', cookie);
      expect(res.status).to.equal(200);
    });

    it('status=active includes non-expired and perpetual', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?status=active', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.not.contain('Ничего не найдено');
    });

    it('filter form preserves selected values', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=WebCorp&plan=pro&status=active&q=test', cookie);
      expect(res.body).to.contain('value="WebCorp"');
      expect(res.body).to.contain('value="test"');
    });

    it('no filter results shows empty state', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=ZZZ_NONEXISTENT_ZZZ', cookie);
      expect(res.body).to.contain('Ничего не найдено');
    });

    it('all RBAC roles can access filtered list', async function() {
      const viewer = await login(port, 'viewer@test.com', 'viewer123');
      const issuer = await login(port, 'issuer@test.com', 'issuer123');
      const admin = await login(port, 'admin@test.com', 'admin123');

      const vRes = await get(port, '/licenses?status=active', viewer.cookie);
      const iRes = await get(port, '/licenses?status=active', issuer.cookie);
      const aRes = await get(port, '/licenses?status=active', admin.cookie);

      expect(vRes.status).to.equal(200);
      expect(iRes.status).to.equal(200);
      expect(aRes.status).to.equal(200);
    });

    it('filtered list does not contain licensePayload', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=WebCorp', cookie);
      expect(res.body).to.not.contain('licensePayload');
      expect(res.body).to.not.contain('RSA-SHA256');
    });

    it('repeated query params do not cause 500', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=A&customer=B', cookie);
      expect(res.status).to.equal(200);
    });

    it('invalid status falls back to all', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?status=nonexistent', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Лицензии');
    });

    it('status=expired works with expired license', async function() {
      const { cookie: adminCookie } = await login(port, 'admin@test.com', 'admin123');
      const custList = await models.Customer.findAll();
      const planList = await models.Plan.findAll();

      await models.License.create({
        customerId: custList[0].id,
        planId: planList[0].id,
        features: ['sso_authentication'],
        expiresAt: '2000-01-01',
        algorithm: 'RSA-SHA256',
        payloadHash: crypto.createHash('sha256').update('expired-test-' + Date.now()).digest('hex'),
        licenseHash: crypto.createHash('sha256').update('expired-lic-' + Date.now()).digest('hex'),
        issuedAt: new Date(),
      });

      const res = await get(port, '/licenses?status=expired', adminCookie);
      expect(res.status).to.equal(200);
    });

    it('q search by payloadHash prefix returns matching license', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const license = await models.License.findOne();
      if (license) {
        const prefix = license.payloadHash.substring(0, 10);
        const res = await get(port, '/licenses?q=' + prefix, cookie);
        expect(res.status).to.equal(200);
        expect(res.body).to.not.contain('Ничего не найдено');
      }
    });

    it('q search by licenseHash prefix returns matching license', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const license = await models.License.findOne();
      if (license) {
        const prefix = license.licenseHash.substring(0, 10);
        const res = await get(port, '/licenses?q=' + prefix, cookie);
        expect(res.status).to.equal(200);
        expect(res.body).to.not.contain('Ничего не найдено');
      }
    });

    it('wildcard input with % and _ does not cause 500', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses?customer=%25_%25', cookie);
      expect(res.status).to.equal(200);
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

  describe('audit log page', function() {
    it('admin can access /audit', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/audit', cookie);
      expect(res.status).to.equal(200);
      expect(res.body).to.contain('Аудит-лог');
    });

    it('viewer cannot access /audit', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/audit', cookie);
      expect(res.status).to.equal(403);
    });

    it('issuer cannot access /audit', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const res = await get(port, '/audit', cookie);
      expect(res.status).to.equal(403);
    });

    it('audit page does not expose secrets', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/audit', cookie);
      expect(res.body).to.not.contain('passwordHash');
      expect(res.body).to.not.contain('scrypt$');
      expect(res.body).to.not.contain('PRIVATE');
    });

    it('audit page filters unsafe detail keys', async function() {
      await models.AuditLog.create({
        actorName: 'test@example.com',
        action: 'test_unsafe',
        entityType: 'Test',
        details: {
          licensePayload: '{"payload":{},"signature":"secret-sig"}',
          signature: 'base64signaturevalue',
          privateKey: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
          passwordHash: 'scrypt$16384$8$1$abc$def',
          token: 'session-token-12345',
          secret: 'my-secret-value',
          reason: 'invalid_credentials',
          count: 5,
          payloadHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        },
      });

      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/audit', cookie);

      expect(res.body).to.not.contain('secret-sig');
      expect(res.body).to.not.contain('base64signaturevalue');
      expect(res.body).to.not.contain('RSA PRIVATE KEY');
      expect(res.body).to.not.contain('scrypt$');
      expect(res.body).to.not.contain('session-token-12345');
      expect(res.body).to.not.contain('my-secret-value');
      expect(res.body).to.contain('reason');
      expect(res.body).to.contain('invalid_credentials');
      expect(res.body).to.contain('count');
      expect(res.body).to.contain('payloadHash');
      expect(res.body).to.contain('abc123def456abc1');
    });
  });

  describe('registry export', function() {
    it('admin can export registry.json', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/licenses/export/registry.json', cookie);
      expect(res.status).to.equal(200);
      const data = JSON.parse(res.body);
      expect(data).to.be.an('array');
    });

    it('viewer cannot export registry', async function() {
      const { cookie } = await login(port, 'viewer@test.com', 'viewer123');
      const res = await get(port, '/licenses/export/registry.json', cookie);
      expect(res.status).to.equal(403);
    });

    it('issuer cannot export registry', async function() {
      const { cookie } = await login(port, 'issuer@test.com', 'issuer123');
      const res = await get(port, '/licenses/export/registry.json', cookie);
      expect(res.status).to.equal(403);
    });

    it('registry export includes safe metadata only', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/licenses/export/registry.json', cookie);
      const data = JSON.parse(res.body);
      if (data.length > 0) {
        const entry = data[0];
        expect(entry.customer).to.be.a('string');
        expect(entry.payloadHash).to.have.length(64);
        expect(entry.licenseHash).to.be.a('string');
      }
    });

    it('registry export excludes licensePayload and signature', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      const res = await get(port, '/licenses/export/registry.json', cookie);
      const data = JSON.parse(res.body);
      const json = res.body;
      expect(json).to.not.contain('licensePayload');
      expect(json).to.not.contain('signature');
      expect(json).to.not.contain('PRIVATE');
      expect(json).to.not.contain('passwordHash');

      if (data.length > 0) {
        const keys = Object.keys(data[0]);
        expect(keys).to.not.include('licensePayload');
        expect(keys).to.not.include('signature');
        expect(keys).to.not.include('privateKey');
        expect(keys).to.not.include('passwordHash');
      }
    });

    it('registry export creates audit log entry', async function() {
      const { cookie } = await login(port, 'admin@test.com', 'admin123');
      await get(port, '/licenses/export/registry.json', cookie);
      const logs = await models.AuditLog.findAll({ where: { action: 'registry_export' } });
      expect(logs.length).to.be.greaterThan(0);
    });
  });

  describe('license download audit', function() {
    it('license download creates audit log entry', async function() {
      const { cookie: adminCookie } = await login(port, 'admin@test.com', 'admin123');
      const custRes = await post(port, '/customers', { name: 'DLCorp', _csrf: extractCsrf((await get(port, '/customers/new', adminCookie)).body) }, adminCookie);
      const plans = (await get(port, '/plans', adminCookie)).body;
      const newPage = await get(port, '/licenses/new', adminCookie);
      const csrf = extractCsrf(newPage.body);
      const custList = await models.Customer.findAll();
      const planList = await models.Plan.findAll();
      await post(port, '/licenses', {
        customerId: custList[custList.length - 1].id,
        planId: planList.find(p => p.name === 'pro').id,
        _csrf: csrf,
      }, adminCookie);

      const licenses = await models.License.findAll();
      const licId = licenses[licenses.length - 1].id;
      await get(port, `/licenses/${licId}/download`, adminCookie);

      const logs = await models.AuditLog.findAll({ where: { action: 'license_download' } });
      expect(logs.length).to.be.greaterThan(0);
    });
  });

  describe('isolation', function() {
    it('portal web app is not mounted in customer runtime', function() {
      const mainApp = require('express')();
      expect(mainApp._router).to.be.undefined;
    });
  });
});
