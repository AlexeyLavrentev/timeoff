'use strict';

function resolveCompanyAuthMode(company) {
  if (!company) {
    return 'local';
  }

  if (company.ldap_auth_enabled) {
    return 'ldap';
  }

  if (company.sso_auth_enabled) {
    return 'sso';
  }

  return 'local';
}

function resolveUserPasswordAuthMode(user) {
  return resolveCompanyAuthMode(user && user.company);
}

function resolveSuccessfulLoginFlow(user) {
  const authMode = resolveUserPasswordAuthMode(user);
  return authMode === 'ldap' ? 'ldap' : 'local';
}

function buildSsoRequiredLoginInfo() {
  return {
    use_sso : true,
    message_key : 'login.messages.useSsoLogin',
    auth_reason : 'sso_required',
  };
}

module.exports = {
  buildSsoRequiredLoginInfo,
  resolveCompanyAuthMode,
  resolveSuccessfulLoginFlow,
  resolveUserPasswordAuthMode,
};
