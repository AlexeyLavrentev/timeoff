'use strict';

const {expect} = require('chai');
const packageJson = require('../../package.json');
const packageLock = require('../../package-lock.json');

describe('Package branding', function() {
  it('uses the LeavePilot Community package name everywhere', function() {
    expect(packageJson.name).to.equal('leavepilot-community');
    expect(packageLock.name).to.equal('leavepilot-community');
    expect(packageLock.packages[''].name).to.equal('leavepilot-community');
  });
});
