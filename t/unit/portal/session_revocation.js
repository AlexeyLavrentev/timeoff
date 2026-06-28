'use strict';

const express = require('express');
const http = require('http');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { hashPassword } = require('../../../portal/auth/passwords');
const { createSessionMiddleware } = require('../../../portal/auth/session');
const { createPortalAuth } = require('../../../portal/auth/middleware');
const { createAuthRouter, createPortalRouter } = require('../../../portal/api/router');
const { listen, close } = require('./http_test_helpers');

const request = (port, method, urlPath, data, cookie, csrfToken) => new Promise((resolve, reject) => {
  const body = data === undefined ? '' : JSON.stringify(data);
  const headers = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers }, res => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
      const setCookie = res.headers['set-cookie'];
      const rawCookie = Array.isArray(setCookie)
        ? setCookie.find(value => value.startsWith('connect.sid='))
        : setCookie;
      let parsed = responseBody;
      try { parsed = responseBody ? JSON.parse(responseBody) : null; } catch (_error) {}
      resolve({
        status: res.statusCode,
        body: parsed,
        cookie: rawCookie ? rawCookie.split(';')[0] : null,
      });
    });
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const runMiddleware = (middleware, req, res) => new Promise((resolve, reject) => {
  middleware(req, res, error => error ? reject(error) : resolve());
});

describe('Portal session revocation', function() {
  let models;
  let server;
  let port;

  beforeEach(async function() {
    models = loadPortalModels({ storage: ':memory:' });
    await models.sequelize.sync();
    await seedPlans(models.Plan);

    const app = express();
    app.use(express.json());
    app.use(createSessionMiddleware({ secret: 'revision-test-secret' }));
    app.get('/seed-session', (req, res) => {
      req.session.preLoginMarker = true;
      res.json({ ok: true });
    });
    app.use('/auth', createAuthRouter(models));
    app.use('/', createPortalRouter(models, { sign: async () => ({}) }));
    ({ server, port } = await listen(app));
  });

  afterEach(async function() {
    await close(server);
    await models.sequelize.close();
  });

  const createUser = async (suffix, role = 'viewer') => models.AdminUser.create({
    email: suffix + '@example.com',
    passwordHash: hashPassword('correct-password'),
    role,
  });

  const login = async user => {
    const csrf = await request(port, 'GET', '/auth/csrf');
    return request(port, 'POST', '/auth/login', {
      email: user.email,
      password: 'correct-password',
    }, csrf.cookie, csrf.body.csrfToken);
  };

  it('regenerates the API session identifier on login', async function() {
    const user = await createUser('api-rotation');
    const seeded = await request(port, 'GET', '/auth/csrf');
    const loggedIn = await request(port, 'POST', '/auth/login', {
      email: user.email,
      password: 'correct-password',
    }, seeded.cookie, seeded.body.csrfToken);

    expect(seeded.cookie).to.be.a('string');
    expect(loggedIn.status).to.equal(200);
    expect(loggedIn.cookie).to.be.a('string');
    expect(loggedIn.cookie).to.not.equal(seeded.cookie);
  });

  it('denies a disabled user on the next API request', async function() {
    const user = await createUser('api-disabled');
    const session = await login(user);
    await user.update({ isActive: false });

    const response = await request(port, 'GET', '/customers', undefined, session.cookie);
    expect(response.status).to.equal(401);
  });

  it('denies a password-reset user on the next API request', async function() {
    const user = await createUser('api-reset');
    const session = await login(user);
    await user.update({ passwordHash: hashPassword('replacement-password') });

    const response = await request(port, 'GET', '/customers', undefined, session.cookie);
    expect(response.status).to.equal(401);
  });

  it('uses the fresh database role after downgrade', async function() {
    const user = await createUser('api-downgrade', 'issuer');
    const session = await login(user);
    await user.update({ role: 'viewer' });

    const response = await request(port, 'POST', '/licenses', {}, session.cookie);
    expect(response.status).to.equal(401);
  });

  it('denies a deleted user on the next API request', async function() {
    const user = await createUser('api-deleted');
    const session = await login(user);
    await user.destroy();

    const response = await request(port, 'GET', '/customers', undefined, session.cookie);
    expect(response.status).to.equal(401);
  });

  ['disabled', 'password-reset', 'role-changed', 'deleted'].forEach(scenario => {
    it('redirects a stale Web session after user is ' + scenario, async function() {
      const user = await createUser('web-' + scenario, 'issuer');
      const req = {
        session: {
          userId: user.id,
          userRole: 'issuer',
          authRevision: user.authRevision,
          destroy(callback) { this.destroyed = true; callback(); },
        },
      };

      if (scenario === 'disabled') await user.update({ isActive: false });
      if (scenario === 'password-reset') await user.update({ passwordHash: hashPassword('replacement-password') });
      if (scenario === 'role-changed') await user.update({ role: 'viewer' });
      if (scenario === 'deleted') await user.destroy();

      const auth = createPortalAuth(models, { kind: 'web' });
      const response = {
        redirectedTo: null,
        redirect(location) { this.redirectedTo = location; },
      };
      await runMiddleware(auth.loadSessionUser, req, response);
      auth.requireAuth(req, response, () => {});

      expect(response.redirectedTo).to.equal('/login');
      expect(req.portalUser).to.equal(null);
    });
  });

  it('authorizes roles from the database instead of the session snapshot', async function() {
    const user = await createUser('fresh-role', 'viewer');
    const req = {
      session: {
        userId: user.id,
        userRole: 'issuer',
        authRevision: user.authRevision,
      },
    };
    const auth = createPortalAuth(models, { kind: 'api' });
    const response = {
      statusCode: null,
      payload: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await runMiddleware(auth.loadSessionUser, req, response);
    auth.requireRole('issuer')(req, response, () => {});

    expect(req.portalUser.role).to.equal('viewer');
    expect(req.session.userRole).to.equal('viewer');
    expect(response.statusCode).to.equal(403);
  });
});
