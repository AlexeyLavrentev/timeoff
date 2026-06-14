#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const features = require('../lib/features');

const parseList = value => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const printUsageAndExit = () => {
  process.stderr.write('Usage: node bin/sign_license.js --customer "Example Ltd" --features sso_authentication,integration_api --secret <secret> [--expires 2027-12-31] [--base64]\n');
  process.exit(1);
};

const secret = argv.secret || process.env.TIMEOFF_LICENSE_SECRET;
const licenseFeatures = parseList(argv.features);

if (!argv.customer || !licenseFeatures.length || !secret) {
  printUsageAndExit();
}

const payload = {
  customer: argv.customer,
  features: licenseFeatures,
};

if (argv.expires) {
  payload.expires = argv.expires;
}

const envelope = {
  payload,
  signature: features.signLicensePayload(payload, secret),
};

if (argv.base64) {
  console.log(Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'));
} else {
  console.log(JSON.stringify(envelope, null, 2));
}
