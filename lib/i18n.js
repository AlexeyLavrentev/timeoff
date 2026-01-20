"use strict";

const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-express-middleware');

let isInitialized = false;

const initI18next = () => {
  if (isInitialized) {
    return i18next;
  }

  i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
      fallbackLng: 'en',
      preload: ['en', 'ru'],
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: path.join(__dirname, '..', 'public', 'locales', '{{lng}}', 'translation.json'),
      },
      detection: {
        order: ['querystring', 'cookie', 'header'],
        caches: ['cookie'],
      },
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
