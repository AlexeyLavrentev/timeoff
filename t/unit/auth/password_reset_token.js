'use strict';

const expect = require('chai').expect;
const {
  DEFAULT_TTL_MS,
  createPasswordResetToken,
  decodePasswordResetToken,
  verifyPasswordResetToken,
} = require('../../../lib/auth/password_reset_token');

describe('Password reset tokens', function() {
  const secret = 'test-secret';
  const passwordHash = 'stored-password-hash';
  const now = Date.UTC(2026, 5, 22, 12, 0, 0);

  it('creates a signed token with a finite expiry', function() {
    const token = createPasswordResetToken({
      email: 'USER@example.test',
      passwordHash,
      secret,
      now,
    });
    const decoded = decodePasswordResetToken(token);

    expect(decoded.payload.email).to.equal('user@example.test');
    expect(decoded.payload.expiresAt).to.equal(now + DEFAULT_TTL_MS);
  });

  it('accepts a valid token before expiry', function() {
    const token = createPasswordResetToken({
      email: 'user@example.test',
      passwordHash,
      secret,
      now,
    });

    expect(verifyPasswordResetToken({
      token,
      passwordHash,
      secret,
      now: now + DEFAULT_TTL_MS - 1,
    })).to.include({
      email: 'user@example.test',
    });
  });

  it('rejects expired, tampered, and password-invalidated tokens', function() {
    const token = createPasswordResetToken({
      email: 'user@example.test',
      passwordHash,
      secret,
      now,
    });

    expect(verifyPasswordResetToken({
      token,
      passwordHash,
      secret,
      now: now + DEFAULT_TTL_MS + 1,
    })).to.equal(null);
    expect(verifyPasswordResetToken({
      token: `${token}x`,
      passwordHash,
      secret,
      now,
    })).to.equal(null);
    expect(verifyPasswordResetToken({
      token,
      passwordHash: 'new-password-hash',
      secret,
      now,
    })).to.equal(null);
  });
});
