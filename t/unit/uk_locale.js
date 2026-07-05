'use strict';

const fs = require('fs');
const path = require('path');
const {expect} = require('chai');

const publicRu = require('../../public/locales/ru/translation.json');
const publicUk = require('../../public/locales/uk/translation.json');
const serverRu = require('../../locales/ru.json');
const serverUk = require('../../locales/uk.json');

function flatten(value, prefix = '', result = {}) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => flatten(child, `${prefix}[${index}]`, result));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      flatten(child, prefix ? `${prefix}.${key}` : key, result);
    });
  } else {
    result[prefix] = value;
  }
  return result;
}

function placeholders(value) {
  return String(value).match(/\{\{[^{}]+\}\}|\{[^{}]+\}/g) || [];
}

function expectLocaleParity(reference, translated) {
  const referenceValues = flatten(reference);
  const translatedValues = flatten(translated);
  expect(Object.keys(translatedValues).sort()).to.deep.equal(Object.keys(referenceValues).sort());

  Object.keys(referenceValues).forEach(key => {
    expect(placeholders(translatedValues[key]).sort(), key)
      .to.deep.equal(placeholders(referenceValues[key]).sort());
  });
}

describe('Ukrainian locale', function() {
  it('matches every RU public key and placeholder', function() {
    expectLocaleParity(publicRu, publicUk);
  });

  it('matches every RU server key and placeholder', function() {
    expectLocaleParity(serverRu, serverUk);
  });

  it('is enabled in file and Redis configurations', function() {
    for (const file of ['app.json', 'app.redis.json']) {
      const config = require(path.join(__dirname, '..', '..', 'config', file));
      expect(config.supported_languages).to.include('uk');
    }
  });

  it('uses Ukrainian CLDR plural forms', function() {
    const i18next = require('../../lib/i18n').initI18next();
    expect(i18next.t('notifications.pendingRequest', {lng: 'uk', count: 1}))
      .to.equal('1 заявка на відпустку');
    expect(i18next.t('notifications.pendingRequest', {lng: 'uk', count: 2}))
      .to.equal('2 заявки на відпустку');
    expect(i18next.t('notifications.pendingRequest', {lng: 'uk', count: 5}))
      .to.equal('5 заявок на відпустку');
  });

  it('renders language choices from configured options', function() {
    const header = fs.readFileSync(
      path.join(__dirname, '..', '..', 'views', 'partials', 'header.hbs'),
      'utf8'
    );
    expect(header).to.include('{{#each supported_language_options}}');
    expect(header).to.include('/language/{{this.code}}');
  });
});
