'use strict';

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
