'use strict';

const expect = require('chai').expect;
const diagnostics = require('../../lib/diagnostics');

describe('Operational diagnostics', function() {
  it('collects safe license, feature, and edition status', async function() {
    const snapshot = await diagnostics.collect({
      env: { NODE_ENV: 'production' },
      features: {
        getLicenseStatus: function() {
          return {
            valid: true,
            reason: 'valid',
            source: 'env',
            customer: 'Example Ltd',
            features: ['time_balance'],
            expires: '2999-12-31T23:59:59.000Z',
          };
        },
        getEnabledMap: function() {
          return {
            time_balance: true,
            vacation_planning: false,
          };
        },
      },
      edition: {
        getInfo: function() {
          return {
            initialized: true,
            premium: {
              loaded: true,
              moduleName: '/opt/timeoff-premium',
              required: true,
            },
            routes: [{name: 'time-balance', path: '/time-balance/'}],
            schedulers: [],
            navigationItems: [{name: 'time-balance', feature: 'time_balance', location: 'primary'}],
            notificationProviders: [{type: 'pending_time_balance_request', feature: 'time_balance'}],
            diagnostics: [{name: 'premium-module'}],
            viewPaths: ['/opt/timeoff-premium/views'],
            emailTemplatePaths: ['/opt/timeoff-premium/email'],
            partialTemplatePaths: ['/opt/timeoff-premium/partials'],
            dbModelPaths: ['/opt/timeoff-premium/db'],
            localePaths: ['/opt/timeoff-premium/locales'],
            migrationPaths: ['/opt/timeoff-premium/migrations'],
            dbAssociations: [{name: 'premium-association'}],
          };
        },
        collectDiagnostics: function() {
          return Promise.resolve([{
            name: 'premium-module',
            loaded: true,
          }]);
        },
      },
    });

    expect(snapshot.environment.nodeEnv).to.equal('production');
    expect(snapshot.license.valid).to.equal(true);
    expect(snapshot.enabledFeatures.time_balance).to.equal(true);
    expect(snapshot.edition.premium.loaded).to.equal(true);
    expect(snapshot.edition.premium.moduleName).to.equal('/opt/timeoff-premium');
    expect(snapshot.edition.counts.routes).to.equal(1);
    expect(snapshot.edition.counts.migrationPaths).to.equal(1);
    expect(snapshot.moduleDiagnostics).to.deep.equal([{
      name: 'premium-module',
      loaded: true,
    }]);
  });

  it('does not expose raw licenses, signatures, secrets, tokens, or keys', async function() {
    const snapshot = await diagnostics.collect({
      env: {
        NODE_ENV: 'production',
        TIMEOFF_LICENSE: 'raw-license-value',
        TIMEOFF_LICENSE_SECRET: 'license-secret-value',
        TIMEOFF_LICENSE_PUBLIC_KEY: 'public-key-value',
      },
      features: {
        getLicenseStatus: function() {
          return {
            valid: true,
            reason: 'valid',
            raw: 'raw-license-value',
            signature: 'signature-value',
            secret: 'license-secret-value',
            token: 'token-value',
            publicKey: 'public-key-value',
            privateKey: 'private-key-value',
            customer: 'Example Ltd',
            features: ['time_balance'],
          };
        },
        getEnabledMap: function() {
          return { time_balance: true };
        },
      },
      edition: {
        getInfo: function() {
          return {
            initialized: true,
            premium: {
              loaded: true,
              moduleName: '/opt/timeoff-premium',
              required: true,
            },
          };
        },
        collectDiagnostics: function() {
          return Promise.resolve([{
            name: 'unsafe-module',
            signature: 'signature-value',
            nested: {
              secret: 'license-secret-value',
              token: 'token-value',
              publicKey: 'public-key-value',
              privateKey: 'private-key-value',
            },
          }]);
        },
      },
    });
    const serialized = JSON.stringify(snapshot);

    expect(serialized).to.not.contain('raw-license-value');
    expect(serialized).to.not.contain('signature-value');
    expect(serialized).to.not.contain('license-secret-value');
    expect(serialized).to.not.contain('token-value');
    expect(serialized).to.not.contain('public-key-value');
    expect(serialized).to.not.contain('private-key-value');
    expect(snapshot.license.raw).to.equal(undefined);
    expect(snapshot.license.signature).to.equal(undefined);
    expect(snapshot.moduleDiagnostics[0].nested).to.deep.equal({});
  });
});
