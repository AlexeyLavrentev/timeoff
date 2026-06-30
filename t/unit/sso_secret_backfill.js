'use strict';

const expect = require('chai').expect;
const Sequelize = require('sequelize');
const backfill = require('../../lib/sso_secret_backfill');

function fakeSecretStore(options) {
  const opts = options || {};

  return {
    isEncrypted: function(value) {
      return typeof value === 'string' && value.indexOf('enc:test:') === 0;
    },
    encryptSecret: function(value) {
      if (opts.missingKey) {
        throw new Error('key unavailable');
      }
      return 'enc:test:' + Buffer.from(value).toString('base64');
    },
    decryptSecret: function(value) {
      if (opts.wrongKey) {
        throw new Error('wrong key with unsafe detail');
      }
      return Buffer.from(value.slice('enc:test:'.length), 'base64').toString('utf8');
    },
  };
}

describe('SSO secret audit/backfill', function() {
  let sequelize;

  beforeEach(async function() {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });
    await sequelize.query(
      'CREATE TABLE `Companies` (`id` INTEGER PRIMARY KEY, `sso_auth_config` TEXT)'
    );
  });

  afterEach(function() {
    return sequelize.close();
  });

  async function insert(id, value) {
    await sequelize.query(
      'INSERT INTO `Companies` (`id`, `sso_auth_config`) VALUES (?, ?)',
      { replacements: [id, value] }
    );
  }

  async function rawValue(id) {
    const rows = await sequelize.query(
      'SELECT sso_auth_config FROM `Companies` WHERE id = ?',
      { replacements: [id], type: sequelize.QueryTypes.SELECT }
    );
    return rows[0].sso_auth_config;
  }

  it('reports one encrypted, plaintext, empty, and malformed row without values', async function() {
    const secret = 'must-never-appear';
    await insert(1, JSON.stringify({ client_secret: 'enc:test:dmFsaWQ=' }));
    await insert(2, JSON.stringify({ client_secret: secret }));
    await insert(3, JSON.stringify({ client_secret: '' }));
    await insert(4, '{broken-json');

    const summary = await backfill.audit({
      sequelize: sequelize,
      secretStore: fakeSecretStore(),
    });
    const output = backfill.formatSummary('dry-run', summary);

    expect(summary).to.deep.equal({
      total: 4,
      encrypted: 1,
      plaintext: 1,
      empty: 1,
      malformed: 1,
      decryptionFailed: 0,
      changed: 0,
    });
    expect(output).to.not.contain(secret);
    expect(output).to.not.contain('dmFsaWQ=');
    expect(output).to.not.contain('{broken-json');
  });

  it('encrypts plaintext once and leaves malformed JSON unchanged', async function() {
    await insert(1, JSON.stringify({ client_id: 'client', client_secret: 'plain-value' }));
    await insert(2, '{broken-json');

    const first = await backfill.apply({
      sequelize: sequelize,
      secretStore: fakeSecretStore(),
    });
    const second = await backfill.apply({
      sequelize: sequelize,
      secretStore: fakeSecretStore(),
    });
    const stored = JSON.parse(await rawValue(1));

    expect(first.changed).to.equal(1);
    expect(second.changed).to.equal(0);
    expect(second.plaintext).to.equal(0);
    expect(stored.client_id).to.equal('client');
    expect(stored.client_secret).to.match(/^enc:test:/);
    expect(await rawValue(2)).to.equal('{broken-json');
  });

  it('fails safely without a key and leaves plaintext retryable', async function() {
    const plaintext = JSON.stringify({ client_secret: 'retry-me' });
    await insert(1, plaintext);

    let failure;
    try {
      await backfill.apply({
        sequelize: sequelize,
        secretStore: fakeSecretStore({ missingKey: true }),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure.code).to.equal('SSO_SECRET_KEY_MISSING');
    expect(failure.message).to.not.contain('retry-me');
    expect(await rawValue(1)).to.equal(plaintext);
  });

  it('reports a wrong key safely and applies no plaintext changes', async function() {
    const encrypted = JSON.stringify({ client_secret: 'enc:test:Y2lwaGVydGV4dA==' });
    const plaintext = JSON.stringify({ client_secret: 'leave-unchanged' });
    await insert(1, encrypted);
    await insert(2, plaintext);

    let failure;
    try {
      await backfill.apply({
        sequelize: sequelize,
        secretStore: fakeSecretStore({ wrongKey: true }),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure.code).to.equal('SSO_SECRET_DECRYPTION_FAILED');
    expect(failure.summary.decryptionFailed).to.equal(1);
    expect(failure.message).to.not.contain('Y2lwaGVydGV4dA==');
    expect(failure.message).to.not.contain('leave-unchanged');
    expect(await rawValue(2)).to.equal(plaintext);
  });
});
