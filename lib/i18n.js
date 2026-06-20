"use strict";

const path = require('path');
const fs = require('fs');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-express-middleware');
const config = require('./config');
const edition = require('./edition');

let isInitialized = false;

const loadEditionResources = supportedLanguages => {
  edition.getLocalePaths().forEach(localePath => {
    supportedLanguages.forEach(language => {
      const resourcePath = path.join(localePath, language, 'translation.json');

      if (!fs.existsSync(resourcePath)) {
        return;
      }

      const resources = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));

      i18next.addResourceBundle(language, 'translation', resources, true, true);
    });
  });
};

const initI18next = () => {
  if (isInitialized) {
    return i18next;
  }

  const supportedLanguages = config.get('supported_languages') || ['en'];
  const defaultLanguage = config.get('default_language') || 'en';

  i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
      fallbackLng: defaultLanguage,
      preload: supportedLanguages,
      initImmediate: false,
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: path.join(__dirname, '..', 'public', 'locales', '{{lng}}', 'translation.json'),
      },
      detection: {
        order: ['querystring', 'cookie', 'header'],
        caches: ['cookie'],
      },
      supportedLngs: supportedLanguages,
      interpolation: {
        escapeValue: false,
      },
    });

  loadEditionResources(supportedLanguages);

  isInitialized = true;

  return i18next;
};

module.exports = {
  i18next,
  initI18next,
};
