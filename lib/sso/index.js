'use strict';

const crypto = require('crypto');
const validator = require('validator');
const config = require('../config');
const model = require('../model/db');
const authLog = require('../util/auth_log');

const SSO_SESSION_KEY = 'sso_login';
const OIDC_ID_TOKEN_SESSION_KEY = 'sso_oidc_id_token';
const oidcIssuerCache = new Map();

function getApplicationDomain() {
  return String(config.get('application_domain') || '').replace(/\/+$/, '');
}

function getOidcCallbackUrl() {
  return getApplicationDomain() + '/login/sso/callback';
}

function getSamlCallbackUrl() {
  return getApplicationDomain() + '/login/sso/callback/saml';
}

function getSamlMetadataUrl(company) {
  return getApplicationDomain() + '/login/sso/metadata/saml/' + company.id;
}

function normalizeEmail(email) {
  return validator.trim(String(email || '')).toLowerCase();
}

function getEmailDomain(email) {
  const normalizedEmail = normalizeEmail(email);
  const parts = normalizedEmail.split('@');
  return parts.length === 2 ? parts[1] : '';
}

function normalizeBoolean(value) {
  return validator.toBoolean(String(value || false));
}

function getSsoConfig(company) {
  if (!company) {
    return {};
  }

  if (typeof company.get === 'function') {
    return company.get('sso_auth_config') || {};
  }

  return company.sso_auth_config || {};
}

function isSsoEnabled(company) {
  return !!(company && company.sso_auth_enabled && company.sso_auth_provider);
}

function getConfiguredEmailDomains(company) {
  const ssoConfig = getSsoConfig(company);

  return String(ssoConfig.email_domains || '')
    .split(/[\s,;]+/)
    .map(domain => validator.trim(String(domain || '')).toLowerCase())
    .filter(Boolean);
}

function isAutoProvisioningEnabled(company) {
  const ssoConfig = getSsoConfig(company);
  return normalizeBoolean(ssoConfig.auto_create_users);
}

function getConfiguredLoginAlias(company) {
  const ssoConfig = getSsoConfig(company);
  return validator.trim(String(ssoConfig.login_alias || '')).toLowerCase();
}

function getTenantSsoLoginPath(company) {
  const loginAlias = getConfiguredLoginAlias(company);

  if (!loginAlias) {
    return null;
  }

  return '/login/sso/tenant/' + encodeURIComponent(loginAlias);
}

function getTenantSsoLoginUrl(company) {
  const loginPath = getTenantSsoLoginPath(company);
  return loginPath ? getApplicationDomain() + loginPath : null;
}

function normalizeCertificate(value) {
  const certificate = String(value || '').trim();

  if (!certificate) {
    return '';
  }

  if (certificate.indexOf('BEGIN CERTIFICATE') >= 0) {
    return certificate.replace(/\\n/g, '\n');
  }

  const body = certificate.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const wrapped = body.match(/.{1,64}/g) || [];

  return '-----BEGIN CERTIFICATE-----\n'
    + wrapped.join('\n')
    + '\n-----END CERTIFICATE-----';
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
}

function logInUser(req, user) {
  return new Promise((resolve, reject) => {
    req.logIn(user, error => error ? reject(error) : resolve());
  });
}

function flashAndRedirectToLogin(req, res, message) {
  req.session.flash_error(message);
  return res.redirect_with_session('/login/');
}

function flashAndRedirectToSsoEntry(req, res, message) {
  req.session.flash_error(message);
  return res.redirect_with_session('/login/sso/');
}

async function findAnyUserByEmail(email) {
  return model.User.find({ where: { email: normalizeEmail(email) } });
}

async function findUserForSso(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await model.User.find_by_email(normalizedEmail);

  if (!user) {
    return null;
  }

  const company = await user.getCompany();
  user.company = company;

  return user;
}

async function getEnabledSsoCompanies() {
  return model.Company.findAll({
    where: {
      sso_auth_enabled: true,
    },
    order: [['id', 'ASC']],
  });
}

async function getEnabledSsoCompanyById(companyId) {
  if (!companyId) {
    return null;
  }

  const company = await model.Company.find({ where: { id: companyId } });

  if (!company || !isSsoEnabled(company)) {
    return null;
  }

  return company;
}

async function getEnabledSsoCompanyByAlias(companyAlias) {
  const normalizedAlias = validator.trim(String(companyAlias || '')).toLowerCase();

  if (!normalizedAlias) {
    return null;
  }

  const companies = await getEnabledSsoCompanies();
  const matchedCompanies = companies.filter(company => getConfiguredLoginAlias(company) === normalizedAlias);

  if (matchedCompanies.length > 1) {
    const error = new Error('Multiple SSO companies match login alias');
    error.code = 'SSO_COMPANY_AMBIGUOUS';
    error.show_to_user = true;
    throw error;
  }

  return matchedCompanies[0] || null;
}

function getResolvedSamlEntityId(company) {
  const ssoConfig = getSsoConfig(company);
  return validator.trim(String(ssoConfig.sp_entity_id || '')) || getSamlMetadataUrl(company);
}

async function getOidcClient(company) {
  const ssoConfig = getSsoConfig(company);
  const issuerUrl = validator.trim(String(ssoConfig.issuer_url || ''));
  const cacheKey = JSON.stringify({
    issuerUrl,
    clientId: ssoConfig.client_id,
    clientSecret: ssoConfig.client_secret,
  });

  if (oidcIssuerCache.has(cacheKey)) {
    return oidcIssuerCache.get(cacheKey);
  }

  const { Issuer, custom } = require('openid-client');

  custom.setHttpOptionsDefaults({ timeout: 15000 });

  const issuer = await Issuer.discover(issuerUrl);
  const client = new issuer.Client({
    client_id: ssoConfig.client_id,
    client_secret: ssoConfig.client_secret || undefined,
    redirect_uris: [getOidcCallbackUrl()],
    response_types: ['code'],
    post_logout_redirect_uris: [getApplicationDomain() + '/login/'],
    token_endpoint_auth_method: ssoConfig.client_secret ? 'client_secret_basic' : 'none',
  });

  oidcIssuerCache.set(cacheKey, client);

  return client;
}

function getOidcEmailFromClaims(company, claims) {
  const ssoConfig = getSsoConfig(company);
  const emailClaim = validator.trim(String(ssoConfig.email_claim || 'email')) || 'email';

  return normalizeEmail(claims && claims[emailClaim]);
}

function getSamlEmailFromProfile(company, profile) {
  const ssoConfig = getSsoConfig(company);
  const attributeName = validator.trim(String(ssoConfig.email_attribute || 'email')) || 'email';
  const rawValue = profile && profile[attributeName];

  if (Array.isArray(rawValue)) {
    return normalizeEmail(rawValue[0]);
  }

  if (rawValue) {
    return normalizeEmail(rawValue);
  }

  return normalizeEmail(profile && (profile.email || profile.mail || profile['urn:oid:0.9.2342.19200300.100.1.3'] || profile.nameID));
}

function getSamlOptions(company) {
  const ssoConfig = getSsoConfig(company);

  return {
    callbackUrl: getSamlCallbackUrl(),
    entryPoint: validator.trim(String(ssoConfig.entry_point || '')),
    issuer: getResolvedSamlEntityId(company),
    audience: getResolvedSamlEntityId(company),
    idpCert: normalizeCertificate(ssoConfig.idp_cert),
    identifierFormat: validator.trim(String(ssoConfig.identifier_format || '')) || undefined,
    validateInResponseTo: 'always',
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: 5000,
    authnRequestBinding: 'HTTP-Redirect',
  };
}

function getSamlClient(company) {
  const { SAML } = require('@node-saml/node-saml');
  return new SAML(getSamlOptions(company));
}

function buildSsoSession(target, extras) {
  return Object.assign({
    email: normalizeEmail(target.email || (target.user && target.user.email)),
    userId: target.user ? target.user.id : null,
    companyId: target.company.id,
  }, extras);
}

function createOidcAuthorizationParams(company, args) {
  const ssoConfig = getSsoConfig(company);
  const params = {
    scope: validator.trim(String(ssoConfig.scope || 'openid profile email')) || 'openid profile email',
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
    state: args.state,
    nonce: args.nonce,
  };

  if (args.loginHint) {
    params.login_hint = args.loginHint;
  }

  return params;
}

async function beginOidcLogin(req, res, target) {
  const { generators } = require('openid-client');
  const client = await getOidcClient(target.company);
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const loginHint = normalizeEmail(target.email || (target.user && target.user.email));

  req.session[SSO_SESSION_KEY] = buildSsoSession(target, {
    provider: 'oidc',
    state,
    nonce,
    codeVerifier,
  });

  await saveSession(req);

  return res.redirect(client.authorizationUrl(createOidcAuthorizationParams(target.company, {
    codeChallenge,
    state,
    nonce,
    loginHint,
  })));
}

async function beginSamlLogin(req, res, target) {
  const samlClient = getSamlClient(target.company);
  const relayState = crypto.randomBytes(24).toString('hex');

  req.session[SSO_SESSION_KEY] = buildSsoSession(target, {
    provider: 'saml',
    relayState,
  });

  await saveSession(req);

  const redirectUrl = await samlClient.getAuthorizeUrlAsync(relayState, undefined, {});
  return res.redirect(redirectUrl);
}

async function completeLogin(req, res, user, successMessage) {
  await logInUser(req, user);

  authLog.logAuthEvent('info', 'sso.login_succeeded', {
    flow: 'sso',
    provider: req.session[SSO_SESSION_KEY] && req.session[SSO_SESSION_KEY].provider || null,
    userId: user.id,
    companyId: user.companyId || user.company && user.company.id || null,
    request: authLog.getRequestMeta(req),
  });

  req.session.flash_message(successMessage || req.t('login.messages.welcomeBack', {
    name: user.name,
  }));

  delete req.session[SSO_SESSION_KEY];

  return res.redirect_with_session('/');
}

async function validateOidcSettings(company) {
  await getOidcClient(company);
}

async function validateSamlSettings(company) {
  const samlClient = getSamlClient(company);
  samlClient.generateServiceProviderMetadata(null, null);
}

async function validateSsoSettings(company) {
  if (!company.sso_auth_enabled) {
    return;
  }

  const loginAlias = getConfiguredLoginAlias(company);

  if (loginAlias) {
    if (!validator.matches(loginAlias, /^[a-z0-9][a-z0-9_-]{1,62}$/)) {
      const error = new Error('SSO login alias is invalid');
      error.show_to_user = true;
      throw error;
    }

    const companyByAlias = await getEnabledSsoCompanyByAlias(loginAlias);

    if (companyByAlias && String(companyByAlias.id) !== String(company.id)) {
      const error = new Error('SSO login alias is already used by another company');
      error.show_to_user = true;
      throw error;
    }
  }

  if (company.sso_auth_provider === 'oidc') {
    return validateOidcSettings(company);
  }

  if (company.sso_auth_provider === 'saml') {
    return validateSamlSettings(company);
  }

  const error = new Error('Unknown SSO provider');
  error.show_to_user = true;
  throw error;
}

function getPublicSsoSummary(company) {
  const ssoConfig = getSsoConfig(company);

  return {
    provider: company.sso_auth_provider || 'oidc',
    config: ssoConfig,
    oidc_callback_url: getOidcCallbackUrl(),
    saml_callback_url: getSamlCallbackUrl(),
    saml_metadata_url: getSamlMetadataUrl(company),
    saml_entity_id: getResolvedSamlEntityId(company),
    tenant_login_url: getTenantSsoLoginUrl(company),
    tenant_login_alias: getConfiguredLoginAlias(company),
  };
}

function getProviderLabel(company) {
  if (!company || !company.sso_auth_provider) {
    return 'SSO';
  }

  return company.sso_auth_provider === 'saml' ? 'SAML 2.0' : 'OIDC';
}

async function getSsoLoginPageContext() {
  const companies = await getEnabledSsoCompanies();
  const directCompany = companies.length === 1 ? companies[0] : null;
  const directSsoUrl = directCompany
    ? (getTenantSsoLoginPath(directCompany) || '/login/sso/direct')
    : null;

  return {
    has_sso_companies: companies.length > 0,
    direct_sso_available: !!directCompany,
    direct_sso_company_name: directCompany ? directCompany.name : null,
    direct_sso_provider_label: getProviderLabel(directCompany),
    direct_sso_url: directSsoUrl,
    default_sso_login_url: directSsoUrl || '/login/sso/',
  };
}

async function resolveCompanyByEmailDomain(email) {
  const emailDomain = getEmailDomain(email);

  if (!emailDomain) {
    return null;
  }

  const companies = await getEnabledSsoCompanies();
  const matchedCompanies = companies.filter(company => getConfiguredEmailDomains(company).indexOf(emailDomain) >= 0);

  if (matchedCompanies.length > 1) {
    const error = new Error('Multiple SSO companies match email domain');
    error.code = 'SSO_COMPANY_AMBIGUOUS';
    error.show_to_user = true;
    throw error;
  }

  return matchedCompanies[0] || null;
}

async function resolveSsoLoginTarget(args) {
  const email = normalizeEmail(args.email);
  const direct = !!args.direct;
  const companyAlias = validator.trim(String(args.companyAlias || '')).toLowerCase();
  const enabledCompanies = await getEnabledSsoCompanies();
  let companyFromAlias = null;

  if (!enabledCompanies.length) {
    return null;
  }

  if (companyAlias) {
    companyFromAlias = await getEnabledSsoCompanyByAlias(companyAlias);

    if (!companyFromAlias) {
      return null;
    }
  }

  if (!email) {
    if (companyFromAlias) {
      return {
        company: companyFromAlias,
        email: null,
        user: null,
      };
    }

    if (direct && enabledCompanies.length === 1) {
      return {
        company: enabledCompanies[0],
        email: null,
        user: null,
      };
    }

    return null;
  }

  const existingUser = await findUserForSso(email);

  if (existingUser) {
    if (!isSsoEnabled(existingUser.company)) {
      return {
        company: null,
        email,
        user: existingUser,
      };
    }

    if (companyFromAlias && String(existingUser.companyId) !== String(companyFromAlias.id)) {
      return {
        company: null,
        email,
        user: existingUser,
      };
    }

    return {
      company: existingUser.company,
      email,
      user: existingUser,
    };
  }

  if (companyFromAlias) {
    return {
      company: companyFromAlias,
      email,
      user: null,
    };
  }

  const companyFromDomain = await resolveCompanyByEmailDomain(email);

  if (companyFromDomain) {
    return {
      company: companyFromDomain,
      email,
      user: null,
    };
  }

  if (enabledCompanies.length === 1) {
    return {
      company: enabledCompanies[0],
      email,
      user: null,
    };
  }

  return null;
}

function toTitleCase(value) {
  const normalizedValue = validator.trim(String(value || ''));

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1).toLowerCase();
}

function deriveUserNameParts(email, profile) {
  const givenName = validator.trim(String(
    (profile && (profile.given_name || profile.givenName || profile.first_name || profile.firstName))
    || ''
  ));
  const familyName = validator.trim(String(
    (profile && (profile.family_name || profile.familyName || profile.last_name || profile.lastName || profile.surname))
    || ''
  ));
  const fullName = validator.trim(String(
    (profile && (profile.name || profile.displayName || profile.cn))
    || ''
  ));

  if (givenName && familyName) {
    return {
      name: givenName,
      lastname: familyName,
    };
  }

  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return {
        name: parts[0],
        lastname: parts.slice(1).join(' '),
      };
    }
  }

  const localPart = normalizeEmail(email).split('@')[0] || 'user';
  const fallbackParts = localPart.split(/[._-]+/).filter(Boolean);

  return {
    name: toTitleCase(fallbackParts[0] || 'SSO'),
    lastname: toTitleCase(fallbackParts.slice(1).join(' ') || 'User'),
  };
}

async function provisionUserForSso(company, email, profile) {
  const existingUser = await findAnyUserByEmail(email);

  if (existingUser) {
    const existingCompany = await existingUser.getCompany();
    existingUser.company = existingCompany;
    return existingUser;
  }

  const department = await model.Department.findOne({
    where: {
      companyId: company.id,
    },
    order: [['id', 'ASC']],
  });

  if (!department) {
    throw new Error('Cannot auto provision SSO user without a department');
  }

  const nameParts = deriveUserNameParts(email, profile);
  const user = await model.User.create({
    email: normalizeEmail(email),
    password: model.User.hashify_password(crypto.randomBytes(32).toString('hex')),
    name: nameParts.name,
    lastname: nameParts.lastname,
    companyId: company.id,
    DepartmentId: department.id,
  });

  user.company = company;
  return user;
}

async function resolveUserForSuccessfulSso(args) {
  const company = args.company;
  const email = normalizeEmail(args.email);
  const profile = args.profile || {};
  const existingUser = await findAnyUserByEmail(email);

  if (existingUser) {
    const existingCompany = await existingUser.getCompany();
    existingUser.company = existingCompany;

    if (String(existingUser.companyId) !== String(company.id)) {
      return {
        errorKey: 'login.messages.ssoCompanyMismatch',
      };
    }

    if (!existingUser.is_active || (typeof existingUser.is_active === 'function' && !existingUser.is_active())) {
      return {
        errorKey: 'login.messages.ssoProvisioningDisabled',
      };
    }

    return { user: existingUser };
  }

  if (!isAutoProvisioningEnabled(company)) {
    return {
      errorKey: 'login.messages.ssoProvisioningDisabled',
    };
  }

  const createdUser = await provisionUserForSso(company, email, profile);
  return { user: createdUser };
}

async function startSsoLogin(req, res, options) {
  options = options || {};

  const body = req.body || {};
  const email = normalizeEmail(body.username || body.email);
  const direct = normalizeBoolean(body.direct || options.direct);
  const companyAlias = validator.trim(String(options.companyAlias || req.params.companyAlias || '')).toLowerCase();
  let target;

  if (email && !validator.isEmail(email)) {
    authLog.logAuthEvent('warn', 'sso.login_failed', {
      flow: 'sso',
      reason: 'invalid_email',
      email: authLog.maskEmail(email),
      companyAlias,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.emailInvalid'));
  }

  if (!email && !direct) {
    authLog.logAuthEvent('warn', 'sso.login_failed', {
      flow: 'sso',
      reason: 'discovery_required',
      companyAlias,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoDiscoveryRequired'));
  }

  try {
    target = await resolveSsoLoginTarget({ email, direct, companyAlias });
  } catch (error) {
    if (error && error.code === 'SSO_COMPANY_AMBIGUOUS') {
      authLog.logAuthEvent('warn', 'sso.login_failed', {
        flow: 'sso',
        reason: 'company_ambiguous',
        email: authLog.maskEmail(email),
        companyAlias,
        request: authLog.getRequestMeta(req),
      });
      return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoCompanyAmbiguous'));
    }
    throw error;
  }

  if (!target || !target.company) {
    authLog.logAuthEvent('warn', 'sso.login_failed', {
      flow: 'sso',
      reason: 'company_unknown',
      email: authLog.maskEmail(email),
      companyAlias,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoCompanyUnknown'));
  }

  if (target.company.sso_auth_provider === 'oidc') {
    authLog.logAuthEvent('info', 'sso.redirect_started', {
      flow: 'sso',
      provider: 'oidc',
      companyId: target.company.id,
      email: authLog.maskEmail(email),
      companyAlias,
      request: authLog.getRequestMeta(req),
    });
    return beginOidcLogin(req, res, target);
  }

  if (target.company.sso_auth_provider === 'saml') {
    authLog.logAuthEvent('info', 'sso.redirect_started', {
      flow: 'sso',
      provider: 'saml',
      companyId: target.company.id,
      email: authLog.maskEmail(email),
      companyAlias,
      request: authLog.getRequestMeta(req),
    });
    return beginSamlLogin(req, res, target);
  }

  authLog.logAuthEvent('warn', 'sso.login_failed', {
    flow: 'sso',
    reason: 'unsupported_provider',
    companyId: target.company.id,
    companyAlias,
    request: authLog.getRequestMeta(req),
  });
  return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoUnsupportedProvider'));
}

async function handleOidcCallback(req, res) {
  const pendingLogin = req.session[SSO_SESSION_KEY];

  if (!pendingLogin || pendingLogin.provider !== 'oidc') {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'session_expired',
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoSessionExpired'));
  }

  if (req.query.error) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'provider_error',
      companyId: pendingLogin.companyId,
      request: authLog.getRequestMeta(req),
    });
    throw new Error(req.query.error_description || req.query.error);
  }

  const company = await getEnabledSsoCompanyById(pendingLogin.companyId);

  if (!company || company.sso_auth_provider !== 'oidc') {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'company_not_configured',
      companyId: pendingLogin.companyId,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoNotConfigured'));
  }

  const client = await getOidcClient(company);
  const params = client.callbackParams(req);
  const tokenSet = await client.callback(getOidcCallbackUrl(), params, {
    state: pendingLogin.state,
    nonce: pendingLogin.nonce,
    code_verifier: pendingLogin.codeVerifier,
  });

  const claims = tokenSet.claims();
  let userInfo = null;
  let oidcEmail = getOidcEmailFromClaims(company, claims);

  if (!oidcEmail && tokenSet.access_token) {
    userInfo = await client.userinfo(tokenSet.access_token);
    oidcEmail = getOidcEmailFromClaims(company, userInfo);
  }

  if (!oidcEmail) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'email_missing',
      companyId: company.id,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoEmailMissing'));
  }

  if (pendingLogin.email && normalizeEmail(oidcEmail) !== normalizeEmail(pendingLogin.email)) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'email_mismatch',
      companyId: company.id,
      email: authLog.maskEmail(oidcEmail),
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoEmailMismatch'));
  }

  const ssoConfig = getSsoConfig(company);
  const emailVerified = claims.email_verified !== undefined
    ? claims.email_verified
    : (userInfo && userInfo.email_verified);

  if (normalizeBoolean(ssoConfig.require_verified_email) && emailVerified === false) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: 'email_not_verified',
      companyId: company.id,
      email: authLog.maskEmail(oidcEmail),
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoEmailNotVerified'));
  }

  req.session[OIDC_ID_TOKEN_SESSION_KEY] = tokenSet.id_token || null;

  const resolvedUser = await resolveUserForSuccessfulSso({
    company,
    email: oidcEmail,
    profile: Object.assign({}, userInfo || {}, claims || {}),
  });

  if (!resolvedUser.user) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'oidc',
      reason: resolvedUser.errorKey === 'login.messages.ssoCompanyMismatch'
        ? 'company_mismatch'
        : 'no_local_provision',
      companyId: company.id,
      email: authLog.maskEmail(oidcEmail),
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t(resolvedUser.errorKey));
  }

  return completeLogin(req, res, resolvedUser.user, req.t('login.messages.ssoWelcomeBack', {
    name: resolvedUser.user.name,
  }));
}

async function handleSamlCallback(req, res) {
  const pendingLogin = req.session[SSO_SESSION_KEY];

  if (!pendingLogin || pendingLogin.provider !== 'saml') {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'session_expired',
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoSessionExpired'));
  }

  if (!req.body.SAMLResponse) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'missing_saml_response',
      companyId: pendingLogin.companyId,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoFailed'));
  }

  if (pendingLogin.relayState && req.body.RelayState && pendingLogin.relayState !== req.body.RelayState) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'state_mismatch',
      companyId: pendingLogin.companyId,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoStateMismatch'));
  }

  const company = await getEnabledSsoCompanyById(pendingLogin.companyId);

  if (!company || company.sso_auth_provider !== 'saml') {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'company_not_configured',
      companyId: pendingLogin.companyId,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoNotConfigured'));
  }

  const samlClient = getSamlClient(company);
  const validationResult = await samlClient.validatePostResponseAsync({
    SAMLResponse: req.body.SAMLResponse,
    RelayState: req.body.RelayState || '',
  });
  const profile = validationResult.profile || {};
  const samlEmail = getSamlEmailFromProfile(company, profile);

  if (!samlEmail) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'email_missing',
      companyId: company.id,
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoEmailMissing'));
  }

  if (pendingLogin.email && normalizeEmail(samlEmail) !== normalizeEmail(pendingLogin.email)) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: 'email_mismatch',
      companyId: company.id,
      email: authLog.maskEmail(samlEmail),
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t('login.messages.ssoEmailMismatch'));
  }

  const resolvedUser = await resolveUserForSuccessfulSso({
    company,
    email: samlEmail,
    profile,
  });

  if (!resolvedUser.user) {
    authLog.logAuthEvent('warn', 'sso.callback_failed', {
      flow: 'sso',
      provider: 'saml',
      reason: resolvedUser.errorKey === 'login.messages.ssoCompanyMismatch'
        ? 'company_mismatch'
        : 'no_local_provision',
      companyId: company.id,
      email: authLog.maskEmail(samlEmail),
      request: authLog.getRequestMeta(req),
    });
    return flashAndRedirectToSsoEntry(req, res, req.t(resolvedUser.errorKey));
  }

  return completeLogin(req, res, resolvedUser.user, req.t('login.messages.ssoWelcomeBack', {
    name: resolvedUser.user.name,
  }));
}

async function renderSamlMetadata(req, res) {
  const company = await model.Company.find({ where : { id : req.params.companyId } });

  if (!company || !isSsoEnabled(company) || company.sso_auth_provider !== 'saml') {
    res.status(404);
    return res.send('SAML metadata is not configured for this company');
  }

  const metadata = getSamlClient(company).generateServiceProviderMetadata(null, null);
  res.type('application/xml');
  return res.send(metadata);
}

async function performOidcLogout(req) {
  if (!req.user || !req.user.company || req.user.company.sso_auth_provider !== 'oidc') {
    return null;
  }

  const idToken = req.session[OIDC_ID_TOKEN_SESSION_KEY];
  if (!idToken) {
    return null;
  }

  const client = await getOidcClient(req.user.company);
  const issuerMetadata = client.issuer.metadata || {};

  if (!issuerMetadata.end_session_endpoint) {
    return null;
  }

  return client.endSessionUrl({
    id_token_hint: idToken,
    post_logout_redirect_uri: getApplicationDomain() + '/login/',
  });
}

module.exports = {
  destroySession,
  getConfiguredEmailDomains,
  getConfiguredLoginAlias,
  getPublicSsoSummary,
  getResolvedSamlEntityId,
  getSsoConfig,
  getSamlMetadataUrl,
  getSsoLoginPageContext,
  getTenantSsoLoginPath,
  getTenantSsoLoginUrl,
  handleOidcCallback,
  handleSamlCallback,
  isAutoProvisioningEnabled,
  isSsoEnabled,
  normalizeCertificate,
  performOidcLogout,
  renderSamlMetadata,
  startSsoLogin,
  validateSsoSettings,
};
