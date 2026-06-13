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
    'FEATURE_TIME_BALANCE',
    'ALLOW_UNLICENSED_FEATURE_OVERRIDES',
  ];
  const originalConfig = {
    licensedFeatures: config.get('licensed_features'),
    featureOverrides: config.get('features'),
    allowUnlicensedFeatureOverrides: config.get('allow_unlicensed_feature_overrides'),
  };

  beforeEach(function() {
    envKeys.forEach(key => {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    });

    config.set('licensed_features', []);
    config.set('features', {});
    config.set('allow_unlicensed_feature_overrides', undefined);
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
