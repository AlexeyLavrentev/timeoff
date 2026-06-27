'use strict';

const crypto = require('crypto');
const expect = require('chai').expect;
const { spawnSync } = require('child_process');
const path = require('path');

const binDir = path.join(__dirname, '..', '..', 'bin');
const node = process.execPath;

const runCli = (script, args, envOverrides) => {
  const result = spawnSync(node, [path.join(binDir, script), ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, envOverrides || {}),
  });

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    status: result.status,
  };
};

describe('License CLI', function() {
  let privateKey;
  let publicKey;

  before(function() {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keyPair.privateKey.export({ type: 'pkcs1', format: 'pem' });
    publicKey = keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' });
  });

  describe('sign_license.js with plan presets', function() {
    it('generates a license with --plan starter', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'Test Corp',
        '--plan', 'starter',
        '--private-key', privateKey,
      ]);

      expect(result.status).to.equal(0);

      const envelope = JSON.parse(result.stdout);
      expect(envelope.algorithm).to.equal('RSA-SHA256');
      expect(envelope.payload.customer).to.equal('Test Corp');
      expect(envelope.payload.plan).to.equal('starter');
      expect(envelope.payload.features).to.deep.equal([]);
    });

    it('generates a license with --plan pro', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'Acme Inc',
        '--plan', 'pro',
        '--private-key', privateKey,
        '--expires', '2027-12-31',
      ]);

      expect(result.status).to.equal(0);

      const envelope = JSON.parse(result.stdout);
      expect(envelope.payload.plan).to.equal('pro');
      expect(envelope.payload.features).to.include('sso_authentication');
      expect(envelope.payload.features).to.include('integration_api');
      expect(envelope.payload.features).to.include('employee_groups');
      expect(envelope.payload.features).to.include('work_calendars');
      expect(envelope.payload.expires).to.equal('2027-12-31');
    });

    it('generates a license with --plan enterprise', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'BigCo',
        '--plan', 'enterprise',
        '--private-key', privateKey,
      ]);

      expect(result.status).to.equal(0);

      const envelope = JSON.parse(result.stdout);
      expect(envelope.payload.plan).to.equal('enterprise');
      expect(envelope.payload.features.length).to.be.greaterThan(4);
      expect(envelope.payload.features).to.include('time_balance');
      expect(envelope.payload.features).to.include('vacation_planning');
    });

    it('rejects unknown plan name', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'Test',
        '--plan', 'nonexistent',
        '--private-key', privateKey,
      ]);

      expect(result.status).to.not.equal(0);
      expect(result.stderr).to.contain('Unknown plan');
    });
  });

  describe('sign_license.js with --features', function() {
    it('generates a valid RSA license', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'Test Corp',
        '--features', 'sso_authentication,integration_api',
        '--private-key', privateKey,
      ]);

      expect(result.status).to.equal(0);

      const envelope = JSON.parse(result.stdout);
      expect(envelope.algorithm).to.equal('RSA-SHA256');
      expect(envelope.payload.customer).to.equal('Test Corp');
      expect(envelope.payload.features).to.deep.equal(['sso_authentication', 'integration_api']);
    });

    it('generates base64 output when --base64 is set', function() {
      const result = runCli('sign_license.js', [
        '--customer', 'Test',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
        '--base64',
      ]);

      expect(result.status).to.equal(0);

      const decoded = JSON.parse(Buffer.from(result.stdout, 'base64').toString('utf8'));
      expect(decoded.algorithm).to.equal('RSA-SHA256');
    });
  });

  describe('license.js inspect', function() {
    it('inspects a license without needing private key', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'InspectMe',
        '--features', 'sso_authentication,integration_api',
        '--private-key', privateKey,
        '--expires', '2028-06-01',
      ]);

      expect(generateResult.status).to.equal(0);

      const inspectResult = runCli('license.js', ['inspect', generateResult.stdout]);

      expect(inspectResult.status).to.equal(0);

      const view = JSON.parse(inspectResult.stdout);
      expect(view.customer).to.equal('InspectMe');
      expect(view.features).to.deep.equal(['sso_authentication', 'integration_api']);
      expect(view.expires).to.equal('2028-06-01');
      expect(view.algorithm).to.equal('RSA-SHA256');
    });

    it('never exposes private key material in inspect output', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'SecurityTest',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
      ]);

      const inspectResult = runCli('license.js', ['inspect', generateResult.stdout]);

      expect(inspectResult.status).to.equal(0);
      expect(inspectResult.stdout).to.not.contain('PRIVATE');
      expect(inspectResult.stdout).to.not.contain('-----BEGIN');
      expect(inspectResult.stdout).to.not.contain(privateKey.substring(0, 30));
    });

    it('never exposes signature in inspect output', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'SecurityTest',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
      ]);

      const envelope = JSON.parse(generateResult.stdout);
      const inspectResult = runCli('license.js', ['inspect', generateResult.stdout]);

      expect(inspectResult.status).to.equal(0);
      expect(inspectResult.stdout).to.not.contain(envelope.signature);
      expect(inspectResult.stdout).to.not.contain('signature');
    });

    it('reads license from file', function() {
      const fs = require('fs');
      const tmpFile = path.join(__dirname, 'tmp_test_license.json');

      try {
        const generateResult = runCli('sign_license.js', [
          '--customer', 'FileTest',
          '--features', 'sso_authentication',
          '--private-key', privateKey,
        ]);

        fs.writeFileSync(tmpFile, generateResult.stdout);

        const inspectResult = runCli('license.js', ['inspect', tmpFile]);

        expect(inspectResult.status).to.equal(0);

        const view = JSON.parse(inspectResult.stdout);
        expect(view.customer).to.equal('FileTest');
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it('inspects plan preset licenses', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'PlanTest',
        '--plan', 'enterprise',
        '--private-key', privateKey,
      ]);

      expect(generateResult.status).to.equal(0);

      const inspectResult = runCli('license.js', ['inspect', generateResult.stdout]);

      expect(inspectResult.status).to.equal(0);

      const view = JSON.parse(inspectResult.stdout);
      expect(view.plan).to.equal('enterprise');
      expect(view.features).to.include('time_balance');
    });
  });

  describe('license.js verify', function() {
    it('verifies a valid RSA license', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'VerifyMe',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
      ]);

      expect(generateResult.status).to.equal(0);

      const verifyResult = runCli('license.js', [
        'verify',
        generateResult.stdout,
        '--public-key', publicKey,
      ]);

      expect(verifyResult.status).to.equal(0);

      const result = JSON.parse(verifyResult.stdout);
      expect(result.valid).to.equal(true);
      expect(result.customer).to.equal('VerifyMe');
    });

    it('rejects a tampered payload', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'TamperTest',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
      ]);

      expect(generateResult.status).to.equal(0);

      const envelope = JSON.parse(generateResult.stdout);
      envelope.payload.features.push('integration_api');
      const tampered = JSON.stringify(envelope);

      const verifyResult = runCli('license.js', [
        'verify',
        tampered,
        '--public-key', publicKey,
      ]);

      expect(verifyResult.status).to.not.equal(0);
      expect(verifyResult.stderr).to.contain('INVALID');
    });

    it('rejects an expired license', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'ExpiredTest',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
        '--expires', '2000-01-01',
      ]);

      expect(generateResult.status).to.equal(0);

      const verifyResult = runCli('license.js', [
        'verify',
        generateResult.stdout,
        '--public-key', publicKey,
      ]);

      expect(verifyResult.status).to.not.equal(0);
      expect(verifyResult.stderr).to.contain('expired');
    });

    it('fails gracefully without public key', function() {
      const generateResult = runCli('sign_license.js', [
        '--customer', 'NoKeyTest',
        '--features', 'sso_authentication',
        '--private-key', privateKey,
      ]);

      const verifyResult = runCli('license.js', [
        'verify',
        generateResult.stdout,
      ], { TIMEOFF_LICENSE_PUBLIC_KEY: '' });

      expect(verifyResult.status).to.not.equal(0);
      expect(verifyResult.stderr).to.contain('public-key');
    });
  });

  describe('license.js plans', function() {
    it('lists all plan presets', function() {
      const result = runCli('license.js', ['plans']);

      expect(result.status).to.equal(0);
      expect(result.stdout).to.contain('starter');
      expect(result.stdout).to.contain('pro');
      expect(result.stdout).to.contain('enterprise');
    });
  });
});
