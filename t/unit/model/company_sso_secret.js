'use strict';

const expect = require('chai').expect;
const model = require('../../../lib/model/db');
const secretStore = require('../../../lib/secret_store');

// Verifies transparent encryption-at-rest of the OIDC client secret on the
// Company model: stored encrypted, read back decrypted, premium consumers
// (which use company.get('sso_auth_config')) keep seeing plaintext.
describe('Company.sso_auth_config client_secret encryption', function () {
  it('stores client_secret encrypted but returns it decrypted', function () {
    const company = model.Company.build({});
    company.set('sso_auth_config', { client_id: 'web', client_secret: 'top-secret' });

    const rawStored = company.getDataValue('sso_auth_config');
    expect(rawStored).to.be.a('string');
    expect(rawStored.indexOf('top-secret')).to.equal(-1); // not plaintext at rest
    expect(JSON.parse(rawStored).client_secret.indexOf('enc:v1:aes-256-gcm:')).to.equal(0);

    const config = company.get('sso_auth_config');
    expect(config.client_id).to.equal('web');
    expect(config.client_secret).to.equal('top-secret'); // transparently decrypted
  });

  it('does not double-encrypt an already-encrypted secret', function () {
    const company = model.Company.build({});
    const preEncrypted = secretStore.encryptSecret('pre-enc');
    company.set('sso_auth_config', { client_secret: preEncrypted });

    expect(company.get('sso_auth_config').client_secret).to.equal('pre-enc');
  });

  it('reads legacy plaintext client_secret unchanged', function () {
    const company = model.Company.build({});
    // Simulate a row written before encryption-at-rest existed.
    company.setDataValue('sso_auth_config', JSON.stringify({ client_id: 'x', client_secret: 'legacy-plain' }));

    expect(company.get('sso_auth_config').client_secret).to.equal('legacy-plain');
  });

  it('handles configs without a client_secret', function () {
    const company = model.Company.build({});
    company.set('sso_auth_config', { client_id: 'x' });
    expect(company.get('sso_auth_config')).to.deep.equal({ client_id: 'x' });
  });
});
