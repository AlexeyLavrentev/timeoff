'use strict';

const expect = require('chai').expect;
const crypto = require('crypto');
const secretStore = require('../../lib/secret_store');

describe('lib/secret_store', function () {
  it('encrypts with the versioned aes-256-gcm prefix', function () {
    const enc = secretStore.encryptSecret('oidc-client-secret-value');
    expect(enc.indexOf('enc:v1:aes-256-gcm:')).to.equal(0);
    expect(secretStore.isEncrypted(enc)).to.equal(true);
  });

  it('round-trips encrypt -> decrypt', function () {
    const plain = 'another-secret-value';
    expect(secretStore.decryptSecret(secretStore.encryptSecret(plain))).to.equal(plain);
  });

  it('produces different ciphertext for the same plaintext (random IV)', function () {
    const a = secretStore.encryptSecret('same-secret');
    const b = secretStore.encryptSecret('same-secret');
    expect(a).to.not.equal(b);
    expect(secretStore.decryptSecret(a)).to.equal('same-secret');
    expect(secretStore.decryptSecret(b)).to.equal('same-secret');
  });

  it('reads legacy plaintext values unchanged', function () {
    const legacy = 'legacy-plaintext-secret';
    expect(secretStore.isEncrypted(legacy)).to.equal(false);
    expect(secretStore.decryptSecret(legacy)).to.equal(legacy);
  });

  it('passes through empty/null/undefined without throwing', function () {
    expect(secretStore.decryptSecret('')).to.equal('');
    expect(secretStore.decryptSecret(null)).to.equal(null);
    expect(secretStore.encryptSecret('')).to.equal('');
    expect(secretStore.encryptSecret(null)).to.equal(null);
  });

  it('fails safely on tampered/invalid ciphertext without leaking the value', function () {
    const enc = secretStore.encryptSecret('top-secret-value');
    const tampered = enc.slice(0, -3) + (enc.slice(-3) === 'AAA' ? 'BBB' : 'AAA');

    expect(function () { secretStore.decryptSecret(tampered); }).to.throw(/Failed to decrypt secret/);

    try {
      secretStore.decryptSecret(tampered);
    } catch (error) {
      expect(error.message.indexOf('top-secret-value')).to.equal(-1);
    }

    expect(function () { secretStore.decryptSecret('enc:v1:aes-256-gcm:only:two'); }).to.throw();
  });

  it('does not collide with a plain md5-looking string (treated as plaintext)', function () {
    const md5like = crypto.createHash('md5').update('x').digest('hex');
    expect(secretStore.isEncrypted(md5like)).to.equal(false);
    expect(secretStore.decryptSecret(md5like)).to.equal(md5like);
  });
});
