'use strict';

function registerPremiumNavigation(registry) {
  registry.registerNavigationItem({
    feature  : 'employee_groups',
    name     : 'groups',
    path     : '/settings/groups/',
    labelKey : 'nav.groups',
    location : 'settings_departments',
    icon     : 'fa-users',
    order    : 20,
  });

  registry.registerNavigationItem({
    feature  : 'sso_authentication',
    name     : 'auth-config',
    path     : '/settings/company/authentication/',
    labelKey : 'nav.authConfig',
    location : 'settings_company',
    icon     : 'fa-lock',
    order    : 40,
  });

  registry.registerNavigationItem({
    feature  : 'integration_api',
    name     : 'integration-api',
    path     : '/settings/company/integration-api/',
    labelKey : 'nav.apiConfig',
    location : 'settings_company',
    icon     : 'fa-plug',
    order    : 50,
  });
}

function register({registry}) {
  registerPremiumNavigation(registry);

  return {
    name: 'community',
  };
}

module.exports = {
  register,
};
