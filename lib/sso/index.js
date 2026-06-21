'use strict';

function notAvailable(name) {
  return function() {
    throw new Error('SSO (' + name + ') requires the premium edition.');
  };
}

module.exports = {
  destroySession              : function(req) { void req; },
  getConfiguredEmailDomains   : notAvailable('getConfiguredEmailDomains'),
  getConfiguredLoginAlias     : notAvailable('getConfiguredLoginAlias'),
  getPublicSsoSummary         : function() { return null; },
  getResolvedSamlEntityId     : notAvailable('getResolvedSamlEntityId'),
  getSsoConfig                : function() { return {}; },
  getSamlMetadataUrl          : notAvailable('getSamlMetadataUrl'),
  getSsoLoginPageContext       : function() { return {}; },
  getTenantSsoLoginPath       : function() { return null; },
  getTenantSsoLoginUrl        : function() { return null; },
  handleOidcCallback          : notAvailable('handleOidcCallback'),
  handleSamlCallback          : notAvailable('handleSamlCallback'),
  isAutoProvisioningEnabled   : function() { return false; },
  isSsoEnabled                : function() { return false; },
  normalizeCertificate        : function(v) { return v; },
  performOidcLogout           : function() { return null; },
  renderSamlMetadata          : notAvailable('renderSamlMetadata'),
  startSsoLogin               : notAvailable('startSsoLogin'),
  validateSsoSettings         : notAvailable('validateSsoSettings'),
};
