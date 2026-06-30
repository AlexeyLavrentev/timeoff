'use strict';

const expect = require('chai').expect;
const crypto = require('crypto');
const password = require('../../../lib/auth/password');

describe('lib/auth/password', function() {

  it('hashes with the scrypt algorithm prefix and a per-user salt', function() {
    const a = password.hashPassword('correct horse');
    const b = password.hashPassword('correct horse');

    expect(a.indexOf('scrypt$')).to.equal(0);
    expect(password.isScryptHash(a)).to.equal(true);
    // Same password, different random salt -> different stored hash.
    expect(a).to.not.equal(b);
  });

  it('verifies a correct password and rejects a wrong one', function() {
    const stored = password.hashPassword('s3cret');

    expect(password.verifyPassword('s3cret', stored)).to.equal(true);
    expect(password.verifyPassword('nope', stored)).to.equal(false);
  });

  it('rejects malformed, empty or non-scrypt stored hashes', function() {
    expect(password.verifyPassword('x', '')).to.equal(false);
    expect(password.verifyPassword('x', 'scrypt$broken')).to.equal(false);
    expect(password.verifyPassword('x', null)).to.equal(false);

    const legacyMd5 = crypto.createHash('md5').update('whatever').digest('hex');
    expect(password.verifyPassword('whatever', legacyMd5)).to.equal(false);
  });

  it('flags non-scrypt (legacy MD5) hashes for rehash, not scrypt ones', function() {
    const legacyMd5 = crypto.createHash('md5').update('whatever').digest('hex');

    expect(password.needsRehash(legacyMd5)).to.equal(true);
    expect(password.needsRehash(password.hashPassword('x'))).to.equal(false);
  });
});
