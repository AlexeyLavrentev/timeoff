'use strict';

const crypto = require('crypto');
const http = require('http');
const expect = require('chai').expect;
const { loadPortalModels } = require('../../../portal/models');
const { seedPlans } = require('../../../portal/seeders/seed_plans');
const { FileSigningProvider } = require('../../../portal/signing/file_signing_provider');
const { createPortalWebApp } = require('../../../portal/web/app');
const { createPersistentStore } = require('../../../portal/auth/session_store');
const { listen, close } = require('./http_test_helpers');

const get = (port, path, cookie) => new Promise((resolve, reject) => {
  const headers = cookie ? { Cookie: cookie } : {};
  http.get(`http://127.0.0.1:${port}${path}`, { headers }, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const setCookie = res.headers['set-cookie'];
      const raw = Array.isArray(setCookie) ? setCookie.find(item => item.startsWith('connect.sid=')) : setCookie;
      resolve({
        status: res.statusCode,
        body,
        headers: res.headers,
        cookie: raw ? raw.split(';')[0] : cookie,
        location: res.headers.location,
      });
    });
  }).on('error', reject);
});

const post = (port, path, data, cookie) => new Promise((resolve, reject) => {
  const body = new URLSearchParams(data).toString();
  const req = http.request(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      Cookie: cookie,
    },
  }, res => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body: responseBody, headers: res.headers }));
  });
  req.on('error', reject);
  req.end(body);
});

const csrfFrom = html => html.match(/name="_csrf"\s+value="([^"]+)"/)[1];

describe('Portal self-service Trial', function() {
  let models;
  let server;
  let port;
  let sent;
  let publicKey;
  let sessionStore;
  let sendError;

  beforeEach(async function() {
    models = loadPortalModels({ storage: ':memory:' });
    await models.sequelize.sync();
    await seedPlans(models.Plan);

    const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKey = keys.privateKey.export({ type: 'pkcs1', format: 'pem' });
    publicKey = keys.publicKey.export({ type: 'pkcs1', format: 'pem' });
    const signingProvider = new FileSigningProvider({ privateKeyPem: privateKey, publicKeyPem: publicKey });
    sent = [];
    sendError = null;
    const trialMailer = {
      sendVerification: async message => {
        if (sendError) throw sendError;
        sent.push(message);
      },
    };
    const trialConfig = {
      trialEnabled: true,
      trialBaseUrl: 'https://portal.example.test',
      trialIpHashSecret: 'test-ip-hash-secret-with-at-least-32-characters',
    };

    sessionStore = createPersistentStore(models.sequelize);
    await sessionStore.sync();
    const app = createPortalWebApp({
      models,
      signingProvider,
      sessionSecret: 'trial-test-session-secret',
      trialConfig,
      trialMailer,
      sessionStore,
    });
    ({ server, port } = await listen(app));
  });

  afterEach(async function() {
    await close(server);
    sessionStore.stopExpiringSessions();
    await models.sequelize.close();
  });

  const requestTrial = async (email = 'hr@example.test', extra = {}) => {
    const page = await get(port, '/trial');
    const response = await post(port, '/trial', {
      _csrf: csrfFrom(page.body),
      organizationName: 'Example Company',
      contactName: 'HR Manager',
      email,
      ...extra,
    }, page.cookie);
    return { page, response };
  };

  it('renders the public Trial form without admin authentication', async function() {
    const response = await get(port, '/trial');
    expect(response.status).to.equal(200);
    expect(response.body).to.contain('30-дневный Trial');
    expect(response.body).to.contain('name="_csrf"');
  });

  it('requires CSRF for Trial requests', async function() {
    const page = await get(port, '/trial');
    const response = await post(port, '/trial', {
      organizationName: 'Example',
      email: 'hr@example.test',
    }, page.cookie);
    expect(response.status).to.equal(403);
    expect(await models.TrialRequest.count()).to.equal(0);
  });

  it('emails a one-time link and stores only its hash', async function() {
    const { response } = await requestTrial();
    expect(response.status).to.equal(200);
    expect(response.body).to.contain('Проверьте почту');
    expect(sent).to.have.length(1);

    const token = new URL(sent[0].verificationUrl).searchParams.get('token');
    const record = await models.TrialRequest.findOne();
    expect(record.normalizedEmail).to.equal('hr@example.test');
    expect(record.tokenHash).to.equal(crypto.createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(record.toJSON())).to.not.contain(token);
  });

  it('rejects invalid public form data without creating a request', async function() {
    const { response } = await requestTrial('not-an-email');
    expect(response.status).to.equal(400);
    expect(response.body).to.contain('корректный рабочий email');
    expect(await models.TrialRequest.count()).to.equal(0);
  });

  it('returns a safe error and marks failed SMTP delivery for retry', async function() {
    sendError = new Error('SMTP password=super-secret connection failed');
    const { response } = await requestTrial();
    expect(response.status).to.equal(400);
    expect(response.body).to.contain('Не удалось отправить письмо');
    expect(response.body).to.not.contain('super-secret');
    expect((await models.TrialRequest.findOne()).status).to.equal('delivery_failed');
  });

  it('redeems once and provides license plus public key to the verified session', async function() {
    const { page } = await requestTrial();
    const token = new URL(sent[0].verificationUrl).searchParams.get('token');
    const verified = await get(port, `/trial/verify?token=${encodeURIComponent(token)}`, page.cookie);
    expect(verified.status).to.equal(302);
    expect(verified.location).to.equal('/trial/confirm');
    expect(await models.License.count()).to.equal(0);
    const sessions = await models.sequelize.query(
      'SELECT data FROM portal_sessions',
      { type: models.Sequelize.QueryTypes.SELECT }
    );
    expect(JSON.stringify(sessions)).to.not.contain(token);
    const confirmPage = await get(port, '/trial/confirm', verified.cookie);
    expect(confirmPage.status).to.equal(200);
    expect(confirmPage.body).to.not.contain(token);
    const confirmed = await post(port, '/trial/confirm', {
      _csrf: csrfFrom(confirmPage.body),
    }, confirmPage.cookie);
    expect(confirmed.status).to.equal(302);
    expect(confirmed.headers.location).to.equal('/trial/success');

    const success = await get(port, '/trial/success', confirmPage.cookie);
    expect(success.status).to.equal(200);
    expect(success.body).to.contain('Trial готов');

    const download = await get(port, '/trial/license', confirmPage.cookie);
    expect(download.status).to.equal(200);
    expect(download.headers['content-disposition']).to.contain('leavepilot-trial-license.json');
    const envelope = JSON.parse(download.body);
    expect(envelope.payload.plan).to.equal('enterprise');
    expect(envelope.payload.maxActiveUsers).to.equal(25);
    expect(new Date(envelope.payload.expiresAt).getTime() - Date.now()).to.be.within(29 * 86400000, 31 * 86400000);

    const key = await get(port, '/trial/public-key', confirmPage.cookie);
    expect(key.status).to.equal(200);
    expect(key.body).to.equal(publicKey);

    const secondUse = await get(port, `/trial/verify?token=${encodeURIComponent(token)}`, page.cookie);
    expect(secondUse.status).to.equal(400);
    expect(await models.License.count()).to.equal(1);
    expect((await models.TrialRequest.findOne()).status).to.equal('issued');
  });

  it('expires verification tokens without issuing a license', async function() {
    const { page } = await requestTrial();
    const token = new URL(sent[0].verificationUrl).searchParams.get('token');
    await (await models.TrialRequest.findOne()).update({ tokenExpiresAt: new Date(Date.now() - 1000) });

    const response = await get(port, `/trial/verify?token=${encodeURIComponent(token)}`, page.cookie);
    expect(response.status).to.equal(400);
    expect(response.body).to.contain('истекла');
    expect(await models.License.count()).to.equal(0);
    expect((await models.TrialRequest.findOne()).status).to.equal('expired');
  });

  it('does not resend or issue another Trial for the same email', async function() {
    const first = await requestTrial();
    const token = new URL(sent[0].verificationUrl).searchParams.get('token');
    const verification = await get(port, `/trial/verify?token=${encodeURIComponent(token)}`, first.page.cookie);
    const confirmation = await get(port, '/trial/confirm', verification.cookie);
    await post(port, '/trial/confirm', { _csrf: csrfFrom(confirmation.body) }, confirmation.cookie);

    const second = await requestTrial('HR@EXAMPLE.TEST');
    expect(second.response.status).to.equal(200);
    expect(sent).to.have.length(1);
    expect(await models.License.count()).to.equal(1);
  });

  it('silently discards honeypot submissions', async function() {
    const { response } = await requestTrial('bot@example.test', { website: 'https://spam.test' });
    expect(response.status).to.equal(200);
    expect(sent).to.have.length(0);
    expect(await models.TrialRequest.count()).to.equal(0);
  });

  it('limits one source IP to five requests per hour', async function() {
    for (let i = 0; i < 5; i += 1) {
      const result = await requestTrial(`hr${i}@example.test`);
      expect(result.response.status).to.equal(200);
    }
    const blocked = await requestTrial('hr5@example.test');
    expect(blocked.response.status).to.equal(429);
    expect(sent).to.have.length(5);
  });
});
