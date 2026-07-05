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
    expect(i18next.hasResourceBundle('en', 'translation')).to.equal(true);
    expect(i18next.t('login.title', {lng: 'en'})).to.not.equal('login.title');
  });

  it('uses CLDR plural forms for English and Russian notifications', function() {
    const i18next = require('../../lib/i18n').initI18next();

    expect(i18next.t('notifications.pendingRequest', {lng: 'en', count: 1}))
      .to.equal('1 leave request to process');
    expect(i18next.t('notifications.pendingRequest', {lng: 'en', count: 2}))
      .to.equal('2 leave requests to process');

    const expected = {
      1  : '1 заявка на отпуск',
      2  : '2 заявки на отпуск',
      5  : '5 заявок на отпуск',
      11 : '11 заявок на отпуск',
      21 : '21 заявка на отпуск',
      22 : '22 заявки на отпуск',
      25 : '25 заявок на отпуск',
    };
    Object.keys(expected).forEach(count => {
      expect(i18next.t('notifications.pendingRequest', {lng: 'ru', count: Number(count)}))
        .to.equal(expected[count]);
    });
  });

  it('contains no obsolete i18next plural suffixes', function() {
    const en = require('../../public/locales/en/translation.json');
    const ru = require('../../public/locales/ru/translation.json');

    const walk = value => Object.entries(value || {}).flatMap(([key, child]) => {
      const nested = child && typeof child === 'object' && !Array.isArray(child)
        ? walk(child)
        : [];
      return [key].concat(nested);
    });

    [en, ru].forEach(locale => {
      walk(locale).forEach(key => expect(key).to.not.match(/_(plural|2|5)$/));
    });
  });
});
