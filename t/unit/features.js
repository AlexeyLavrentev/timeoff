'use strict';

const crypto = require('crypto');
const expect = require('chai').expect;

const config = require('../../lib/config');
const features = require('../../lib/features');

describe('Feature licensing', function() {
  const originalEnv = {};
  const envKeys = [
    'NODE_ENV',
    'TIMEOFF_FEATURES',
    'TIMEOFF_LICENSE',
    'TIMEOFF_LICENSE_SECRET',
    'TIMEOFF_LICENSE_PUBLIC_KEY',
    'FEATURE_TIME_BALANCE',
    'ALLOW_UNLICENSED_FEATURE_OVERRIDES',
    'ALLOW_UNSIGNED_LICENSES',
  ];
  const originalConfig = {
    licensedFeatures: config.get('licensed_features'),
    featureOverrides: config.get('features'),
    allowUnlicensedFeatureOverrides: config.get('allow_unlicensed_feature_overrides'),
    allowUnsignedLicenses: config.get('allow_unsigned_licenses'),
    licenseSecret: config.get('license_secret'),
    licensePublicKey: config.get('license_public_key'),
  };

  beforeEach(function() {
    envKeys.forEach(key => {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    });

    config.set('licensed_features', []);
    config.set('features', {});
    config.set('allow_unlicensed_feature_overrides', undefined);
    config.set('allow_unsigned_licenses', undefined);
    config.set('license_secret', undefined);
    config.set('license_public_key', undefined);
    features.registerFeature('time_balance');
    features.registerFeature('vacation_planning');
  });

  afterEach(function() {
    envKeys.forEach(key => {
      if (typeof originalEnv[key] === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });

    config.set('licensed_features', originalConfig.licensedFeatures);
    config.set('features', originalConfig.featureOverrides);
    config.set('allow_unlicensed_feature_overrides', originalConfig.allowUnlicensedFeatureOverrides);
    config.set('allow_unsigned_licenses', originalConfig.allowUnsignedLicenses);
    config.set('license_secret', originalConfig.licenseSecret);
    config.set('license_public_key', originalConfig.licensePublicKey);
  });

  it('allows TIMEOFF_FEATURES outside production-like environments', function() {
    process.env.NODE_ENV = 'test';
    process.env.TIMEOFF_FEATURES = 'time_balance';

    expect(features.isEnabled('time_balance')).to.equal(true);
  });

  it('ignores unlicensed TIMEOFF_FEATURES in production-like environments', function() {
    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_FEATURES = 'time_balance';

    expect(features.isEnabled('time_balance')).to.equal(false);
  });

  it('keeps licensed features enabled in production-like environments', function() {
    process.env.NODE_ENV = 'production';
    config.set('licensed_features', ['time_balance']);

    expect(features.isEnabled('time_balance')).to.equal(true);
  });

  it('ignores unsigned TIMEOFF_LICENSE payloads in production-like environments', function() {
    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      features: ['time_balance'],
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
  });

  it('keeps signed TIMEOFF_LICENSE payloads enabled in production-like environments', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };
    const secret = 'test-license-secret';

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      signature: features.signLicensePayload(payload, secret),
    });

    expect(features.isEnabled('time_balance')).to.equal(true);
  });

  it('keeps RSA signed TIMEOFF_LICENSE payloads enabled in production-like environments', function() {
    const keyPair = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
    const privateKey = keyPair.privateKey.export({type: 'pkcs1', format: 'pem'});
    const publicKey = keyPair.publicKey.export({type: 'pkcs1', format: 'pem'});
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_PUBLIC_KEY = publicKey;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      algorithm: 'RSA-SHA256',
      signature: features.signLicensePayloadWithPrivateKey(payload, privateKey),
    });

    expect(features.isEnabled('time_balance')).to.equal(true);
    expect(features.getLicenseStatus()).to.deep.equal({
      valid: true,
      reason: 'valid',
      source: 'env',
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: null,
    });
  });

  it('rejects RSA signed TIMEOFF_LICENSE payloads without a public key', function() {
    const keyPair = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
    const privateKey = keyPair.privateKey.export({type: 'pkcs1', format: 'pem'});
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      algorithm: 'RSA-SHA256',
      signature: features.signLicensePayloadWithPrivateKey(payload, privateKey),
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.getLicenseStatus().reason).to.equal('missing_signature_or_public_key');
  });

  it('keeps signed TIMEOFF_LICENSE payloads with future expiry enabled', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: '2999-12-31T23:59:59.000Z',
    };
    const secret = 'test-license-secret';

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      signature: features.signLicensePayload(payload, secret),
    });

    expect(features.isEnabled('time_balance')).to.equal(true);
    expect(features.getLicenseStatus()).to.deep.equal({
      valid: true,
      reason: 'valid',
      source: 'env',
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: '2999-12-31T23:59:59.000Z',
    });
  });

  it('rejects signed TIMEOFF_LICENSE payloads with past expiry', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: '2000-01-01T00:00:00.000Z',
    };
    const secret = 'test-license-secret';

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      signature: features.signLicensePayload(payload, secret),
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.getLicenseStatus().reason).to.equal('expired');
  });

  it('rejects signed TIMEOFF_LICENSE payloads with malformed expiry', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: 'not-a-date',
    };
    const secret = 'test-license-secret';

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      signature: features.signLicensePayload(payload, secret),
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.getLicenseStatus().reason).to.equal('invalid_expiry');
  });

  it('does not expose raw license or signature in license status', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };
    const secret = 'test-license-secret';
    const signature = features.signLicensePayload(payload, secret);

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({payload, signature});

    const status = features.getLicenseStatus();

    expect(status.customer).to.equal('Example Ltd');
    expect(status.features).to.deep.equal(['time_balance']);
    expect(status.signature).to.equal(undefined);
    expect(status.secret).to.equal(undefined);
    expect(status.raw).to.equal(undefined);
    expect(JSON.stringify(status)).to.not.contain(signature);
    expect(JSON.stringify(status)).to.not.contain(secret);
  });

  it('rejects expired unsigned TIMEOFF_LICENSE payloads in development environments', function() {
    process.env.NODE_ENV = 'test';
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: '2000-01-01T00:00:00.000Z',
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.getLicenseStatus().reason).to.equal('expired');
  });

  it('keeps unsigned TIMEOFF_LICENSE payloads enabled in development environments', function() {
    process.env.NODE_ENV = 'test';
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      customer: 'Example Ltd',
      features: ['time_balance'],
      expires: '2999-12-31T23:59:59.000Z',
    });

    expect(features.isEnabled('time_balance')).to.equal(true);
    expect(features.getLicenseStatus().reason).to.equal('valid');
  });

  it('rejects TIMEOFF_LICENSE payloads with mismatched signatures', function() {
    const signedPayload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };
    const tamperedPayload = {
      customer: 'Example Ltd',
      features: ['time_balance', 'vacation_planning'],
    };
    const secret = 'test-license-secret';

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_SECRET = secret;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload: tamperedPayload,
      signature: features.signLicensePayload(signedPayload, secret),
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.isEnabled('vacation_planning')).to.equal(false);
  });

  it('rejects RSA TIMEOFF_LICENSE payloads with mismatched signatures', function() {
    const keyPair = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
    const privateKey = keyPair.privateKey.export({type: 'pkcs1', format: 'pem'});
    const publicKey = keyPair.publicKey.export({type: 'pkcs1', format: 'pem'});
    const signedPayload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };
    const tamperedPayload = {
      customer: 'Example Ltd',
      features: ['time_balance', 'vacation_planning'],
    };

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE_PUBLIC_KEY = publicKey;
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload: tamperedPayload,
      algorithm: 'RSA-SHA256',
      signature: features.signLicensePayloadWithPrivateKey(signedPayload, privateKey),
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.isEnabled('vacation_planning')).to.equal(false);
  });

  it('rejects TIMEOFF_LICENSE payloads with unsupported signature algorithms', function() {
    const payload = {
      customer: 'Example Ltd',
      features: ['time_balance'],
    };

    process.env.NODE_ENV = 'production';
    process.env.TIMEOFF_LICENSE = JSON.stringify({
      payload,
      algorithm: 'MD5',
      signature: 'not-used',
    });

    expect(features.isEnabled('time_balance')).to.equal(false);
    expect(features.getLicenseStatus().reason).to.equal('unsupported_signature_algorithm');
  });

  it('lets explicit false overrides disable licensed features', function() {
    process.env.NODE_ENV = 'production';
    process.env.FEATURE_TIME_BALANCE = 'false';
    config.set('licensed_features', ['time_balance']);

    expect(features.isEnabled('time_balance')).to.equal(false);
  });

  it('returns a JSON 403 response for disabled API features', function() {
    const middleware = features.requireFeature('time_balance');
    const req = {
      originalUrl: '/api/v1/time-balance/',
      accepts(types) {
        return types.indexOf('json') === -1 ? false : 'json';
      },
      t(key) {
        return key;
      },
    };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    middleware(req, res, function() {
      throw new Error('Middleware should not continue for disabled features');
    });

    expect(res.statusCode).to.equal(403);
    expect(res.payload).to.deep.equal({
      error: 'feature_disabled',
      feature: 'time_balance',
      message: 'features.messages.disabled',
    });
  });
});
