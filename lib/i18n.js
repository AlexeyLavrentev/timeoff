"use strict";

const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-express-middleware');
const config = require('./config');

let isInitialized = false;

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

  isInitialized = true;

  return i18next;
};

module.exports = {
  i18next,
  initI18next,
};
