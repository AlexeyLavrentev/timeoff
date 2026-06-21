'use strict';

const edition = require('../edition');

const ssoProxy = new Proxy({}, {
  get(_, prop) {
    const provider = edition.getRegistry().getSsoProvider();

    if (!provider) {
      throw new Error(
        'SSO provider is not registered. ' +
        'Ensure the premium edition is loaded before using SSO.'
      );
    }

    const value = provider[prop];

    return typeof value === 'function' ? value.bind(provider) : value;
  },

  set(_, prop, value) {
    const provider = edition.getRegistry().getSsoProvider();

    if (!provider) {
      throw new Error('SSO provider is not registered.');
    }

    provider[prop] = value;

    return true;
  },
});

module.exports = {
  policy   : require('./policy'),
  providers : {
    sso : ssoProxy,
  },
  settings : require('./settings'),
};
