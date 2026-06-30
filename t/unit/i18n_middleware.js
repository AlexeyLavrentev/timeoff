'use strict';

const {expect} = require('chai');

describe('i18n HTTP middleware compatibility', function() {
  it('uses the maintained middleware compatible with current i18next', function() {
    const dependencies = require('../../package.json').dependencies;
    expect(dependencies).to.have.property('i18next-http-middleware');
    expect(dependencies).to.not.have.property('i18next-express-middleware');

    const middleware = require('i18next-http-middleware');
    const i18next = require('../../lib/i18n').initI18next();
    expect(middleware.handle).to.be.a('function');
    expect(i18next.services.languageUtils).to.exist;
    expect(i18next.services.languageUtils.isWhitelisted).to.equal(undefined);
  });
});
