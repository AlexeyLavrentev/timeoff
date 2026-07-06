'use strict';

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

describe('Commercial container dependencies', function() {
  var dockerfile = fs.readFileSync(path.join(__dirname, '..', '..', 'Dockerfile'), 'utf8');

  it('installs Premium production dependencies inside the module', function() {
    expect(dockerfile).to.include('cd "${PREMIUM_MODULE_TARGET}"');
    expect(dockerfile).to.include('npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund');
  });
});
