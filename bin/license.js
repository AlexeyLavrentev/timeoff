#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const features = require('../lib/features');

const subcommand = argv._[0];

const printUsageAndExit = () => {
  process.stderr.write([
    'LeavePilot License CLI',
    '',
    'Usage:',
    '  node bin/license.js inspect <license-file-or-string>         Show license payload (no private key needed)',
    '  node bin/license.js verify  <license-file-or-string> [--public-key-file key.pem]  Verify signature',
    '  node bin/license.js generate --customer "Name" --plan <plan> --private-key-file key.pem  Generate license',
    '  node bin/license.js plans                                    List available plan presets',
    '',
    'Global options:',
    '  --base64    Treat input as base64-encoded license',
    '',
  ].join('\n'));
  process.exit(1);
};

const readLicenseInput = raw => {
  if (!raw) return null;

  if (fs.existsSync(raw)) {
    return fs.readFileSync(raw, 'utf8').trim();
  }

  return raw;
};

const parseAndDecode = raw => {
  const result = features.parseLicense(raw);

  if (result.reason === 'missing' || result.reason === 'invalid_format') {
    return { error: `Cannot parse license: ${result.reason}` };
  }

  return { envelope: result.parsed };
};

const safePayloadView = envelope => {
  if (!envelope || !envelope.payload) return null;

  const p = envelope.payload;
  return {
    customer: p.customer || null,
    plan: p.plan || null,
    features: Array.isArray(p.features) ? p.features : [],
    expires: p.expires || null,
    algorithm: envelope.algorithm || 'HMAC-SHA256',
  };
};

const handleInspect = () => {
  const raw = readLicenseInput(argv._[1]);

  if (!raw) {
    process.stderr.write('Usage: node bin/license.js inspect <license-file-or-string>\n');
    process.exit(1);
  }

  const { envelope, error } = parseAndDecode(raw);

  if (error) {
    process.stderr.write(error + '\n');
    process.exit(1);
  }

  const view = safePayloadView(envelope);

  if (!view) {
    process.stderr.write('License has no payload.\n');
    process.exit(1);
  }

  console.log(JSON.stringify(view, null, 2));
};

const handleVerify = () => {
  const raw = readLicenseInput(argv._[1]);

  if (!raw) {
    process.stderr.write('Usage: node bin/license.js verify <license-file-or-string> [--public-key-file key.pem]\n');
    process.exit(1);
  }

  const { envelope, error } = parseAndDecode(raw);

  if (error) {
    process.stderr.write('PARSE ERROR: ' + error + '\n');
    process.exit(1);
  }

  const algorithm = String(envelope.algorithm || 'HMAC-SHA256').toUpperCase();

  if (algorithm === 'RSA-SHA256') {
    const publicKey = argv['public-key']
      || (argv['public-key-file'] ? fs.readFileSync(argv['public-key-file'], 'utf8').trim() : '')
      || features.getLicensePublicKey();

    if (!publicKey) {
      process.stderr.write('RSA verification requires --public-key-file or TIMEOFF_LICENSE_PUBLIC_KEY.\n');
      process.exit(1);
    }

    process.env.TIMEOFF_LICENSE_PUBLIC_KEY = publicKey;
    const result = features.verifyLicenseEnvelope(envelope, 'cli');

    if (!result.valid) {
      process.stderr.write('INVALID: ' + result.reason + '\n');
      process.exit(1);
    }

    const view = safePayloadView(envelope);
    console.log(JSON.stringify({ valid: true, reason: result.reason, ...view }, null, 2));
    return;
  }

  if (algorithm === 'HMAC-SHA256') {
    const secret = argv.secret || process.env.TIMEOFF_LICENSE_SECRET;

    if (!secret) {
      process.stderr.write('HMAC verification requires --secret or TIMEOFF_LICENSE_SECRET.\n');
      process.exit(1);
    }

    process.env.TIMEOFF_LICENSE_SECRET = secret;
    const result = features.verifyLicenseEnvelope(envelope, 'cli');

    if (!result.valid) {
      process.stderr.write('INVALID: ' + result.reason + '\n');
      process.exit(1);
    }

    const view = safePayloadView(envelope);
    console.log(JSON.stringify({ valid: true, reason: result.reason, ...view }, null, 2));
    return;
  }

  process.stderr.write('Unsupported algorithm: ' + algorithm + '\n');
  process.exit(1);
};

const handlePlans = () => {
  const plans = features.planPresets;
  const lines = Object.keys(plans).map(name => {
    const p = plans[name];
    return `${name.padEnd(12)} ${p.description}\n              Features: ${p.features.length ? p.features.join(', ') : '(none — community defaults)'}`;
  });

  console.log('Available plan presets:\n');
  console.log(lines.join('\n\n'));
  console.log('\nRaw --features list always overrides plan presets.');
};

const handleGenerate = () => {
  const generateArgs = ['--customer', ...argv.customer ? [argv.customer] : []];

  if (argv.plan) generateArgs.push('--plan', argv.plan);
  if (argv.features) generateArgs.push('--features', argv.features);
  if (argv['private-key-file']) generateArgs.push('--private-key-file', argv['private-key-file']);
  if (argv['private-key']) generateArgs.push('--private-key', argv['private-key']);
  if (argv.secret) generateArgs.push('--secret', argv.secret);
  if (argv.expires) generateArgs.push('--expires', argv.expires);
  if (argv.base64) generateArgs.push('--base64');

  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, ['bin/sign_license.js', ...generateArgs], {
    stdio: 'inherit',
    cwd: __dirname + '/..',
  });

  process.exit(result.status || 0);
};

const handlers = {
  inspect: handleInspect,
  verify: handleVerify,
  generate: handleGenerate,
  plans: handlePlans,
};

if (!subcommand || !handlers[subcommand]) {
  printUsageAndExit();
}

handlers[subcommand]();
