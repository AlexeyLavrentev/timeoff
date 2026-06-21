'use strict';

const ssoStub = require('../sso');

function registerPremiumNavigation(registry) {
  registry.registerNavigationItem({
    feature  : 'ldap_authentication',
    name     : 'auth-config',
    path     : '/settings/company/authentication/',
    labelKey : 'nav.authConfig',
    location : 'settings_company',
    icon     : 'fa-lock',
    order    : 40,
  });
}

function register({registry}) {
  registerPremiumNavigation(registry);
  registry.registerSsoProvider(ssoStub);

  return {
    name: 'community',
  };
}

module.exports = {
  register,
};
