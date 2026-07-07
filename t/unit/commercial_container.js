'use strict';

var expect = require('chai').expect;
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

describe('Commercial container dependencies', function() {
  var dockerfile = fs.readFileSync(path.join(__dirname, '..', '..', 'Dockerfile'), 'utf8');

  it('installs Premium production dependencies inside the module', function() {
    expect(dockerfile).to.include('cd "${PREMIUM_MODULE_TARGET}"');
    expect(dockerfile).to.include('npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund');
  });

  it('marks the commercial image and defaults it to production', function() {
    expect(dockerfile).to.include('ENV NODE_ENV=production');
    expect(dockerfile).to.include('TIMEOFF_EDITION=commercial');
    expect(dockerfile).to.include('touch /app/.timeoff-commercial');
  });

  it('fails closed without secrets in commercial edition outside production', function() {
    var projectRoot = path.join(__dirname, '..', '..');
    var env = Object.assign({}, process.env, {
      NODE_ENV: 'development',
      TIMEOFF_EDITION: 'commercial',
    });

    delete env.SESSION_SECRET;
    delete env.CRYPTO_SECRET;

    var result = childProcess.spawnSync(
      process.execPath,
      ['-e', "require('./lib/config')"],
      {cwd: projectRoot, env: env, encoding: 'utf8'}
    );

    expect(result.status).not.to.equal(0);
    expect(result.stderr).to.include('SESSION_SECRET, CRYPTO_SECRET');
  });
});
