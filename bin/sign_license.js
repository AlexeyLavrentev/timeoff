#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const features = require('../lib/features');

const parseList = value => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const AVAILABLE_FEATURES = [
  ...Object.keys(features.catalog),
  ...Object.keys(features.planPresets).reduce((acc, name) => {
    features.planPresets[name].features.forEach(f => {
      if (acc.indexOf(f) === -1) acc.push(f);
    });
    return acc;
  }, []),
].filter((v, i, a) => a.indexOf(v) === i);

const printUsageAndExit = () => {
  const planLines = Object.keys(features.planPresets).map(name => {
    const preset = features.planPresets[name];
    return `    ${name.padEnd(12)} ${preset.description} [${preset.features.length ? preset.features.join(', ') : 'defaults only'}]`;
  });

  process.stderr.write([
    'Usage:',
    '  node bin/sign_license.js --customer "Name" --plan <starter|pro|enterprise> --private-key-file key.pem [--expires 2027-12-31] [--base64]',
    '  node bin/sign_license.js --customer "Name" --features feat1,feat2 --private-key-file key.pem [--expires 2027-12-31] [--base64]',
    '',
    'Options:',
    '  --customer        Customer name (required)',
    '  --plan            Plan preset (alternative to --features):',
    ...planLines,
    '  --features        Comma-separated feature list (alternative to --plan)',
    '  --expires         Expiry date in ISO format (optional)',
    '  --private-key-file  Path to RSA private key PEM file',
    '  --private-key     Private key PEM string (prefer --private-key-file)',
    '  --secret          HMAC secret (legacy, prefer RSA)',
    '  --base64          Output as base64 instead of JSON',
    '',
    'Available features:',
    `  ${AVAILABLE_FEATURES.join(', ')}`,
    '',
  ].join('\n'));
  process.exit(1);
};

const secret = argv.secret || process.env.TIMEOFF_LICENSE_SECRET;
const privateKey = argv['private-key']
  || (argv['private-key-file'] ? fs.readFileSync(argv['private-key-file'], 'utf8') : '')
  || process.env.TIMEOFF_LICENSE_PRIVATE_KEY;

let licenseFeatures;
let resolvedPlan = null;

if (argv.features) {
  licenseFeatures = parseList(argv.features);
} else if (argv.plan) {
  const preset = features.resolvePlan(argv.plan);

  if (!preset) {
    process.stderr.write(`Unknown plan: ${argv.plan}. Available: ${Object.keys(features.planPresets).join(', ')}\n`);
    process.exit(1);
  }

  licenseFeatures = preset.features;
  resolvedPlan = argv.plan;
}

if (!argv.customer || (!licenseFeatures && !resolvedPlan) || (!secret && !privateKey)) {
  printUsageAndExit();
}

const payload = {
  customer: argv.customer,
  features: licenseFeatures,
};

if (resolvedPlan) {
  payload.plan = resolvedPlan;
}

if (argv.expires) {
  payload.expires = argv.expires;
}

const envelope = privateKey
  ? {
      payload,
      algorithm: 'RSA-SHA256',
      signature: features.signLicensePayloadWithPrivateKey(payload, privateKey),
    }
  : {
      payload,
      algorithm: 'HMAC-SHA256',
      signature: features.signLicensePayload(payload, secret),
    };

if (argv.base64) {
  console.log(Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'));
} else {
  console.log(JSON.stringify(envelope, null, 2));
}
