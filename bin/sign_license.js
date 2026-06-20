#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const features = require('../lib/features');

const parseList = value => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const printUsageAndExit = () => {
  process.stderr.write([
    'Usage:',
    '  node bin/sign_license.js --customer "Example Ltd" --features sso_authentication,integration_api --secret <secret> [--expires 2027-12-31] [--base64]',
    '  node bin/sign_license.js --customer "Example Ltd" --features sso_authentication,integration_api --private-key-file private.pem [--expires 2027-12-31] [--base64]',
    '',
  ].join('\n'));
  process.exit(1);
};

const secret = argv.secret || process.env.TIMEOFF_LICENSE_SECRET;
const privateKey = argv['private-key']
  || (argv['private-key-file'] ? fs.readFileSync(argv['private-key-file'], 'utf8') : '')
  || process.env.TIMEOFF_LICENSE_PRIVATE_KEY;
const licenseFeatures = parseList(argv.features);

if (!argv.customer || !licenseFeatures.length || (!secret && !privateKey)) {
  printUsageAndExit();
}

const payload = {
  customer: argv.customer,
  features: licenseFeatures,
};

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
