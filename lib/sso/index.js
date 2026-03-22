'use strict';

const crypto = require('crypto');
const validator = require('validator');
const config = require('../config');
const model = require('../model/db');

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

function buildSsoSession(user, extras) {
  return Object.assign({
    email: normalizeEmail(user.email),
    userId: user.id,
    companyId: user.companyId,
  }, extras);
}

async function beginOidcLogin(req, res, user) {
  const { generators } = require('openid-client');
  const company = user.company;
  const client = await getOidcClient(company);
  const ssoConfig = getSsoConfig(company);
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  req.session[SSO_SESSION_KEY] = buildSsoSession(user, {
    provider: 'oidc',
    state,
    nonce,
    codeVerifier,
  });

  await saveSession(req);

  return res.redirect(client.authorizationUrl({
    scope: validator.trim(String(ssoConfig.scope || 'openid profile email')) || 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    login_hint: user.email,
  }));
}

async function beginSamlLogin(req, res, user) {
  const samlClient = getSamlClient(user.company);
  const relayState = crypto.randomBytes(24).toString('hex');

  req.session[SSO_SESSION_KEY] = buildSsoSession(user, {
    provider: 'saml',
    relayState,
  });

  await saveSession(req);

  const redirectUrl = await samlClient.getAuthorizeUrlAsync(relayState, undefined, {});
  return res.redirect(redirectUrl);
}

async function completeLogin(req, res, user, successMessage) {
  await logInUser(req, user);

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
  };
}

async function startSsoLogin(req, res) {
  const email = normalizeEmail(req.body.username || req.body.email);

  if (!email) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.emailMissing'));
  }

  if (!validator.isEmail(email)) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.emailInvalid'));
  }

  const user = await findUserForSso(email);

  if (!user || !isSsoEnabled(user.company)) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoNotConfigured'));
  }

  if (user.company.sso_auth_provider === 'oidc') {
    return beginOidcLogin(req, res, user);
  }

  if (user.company.sso_auth_provider === 'saml') {
    return beginSamlLogin(req, res, user);
  }

  return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoUnsupportedProvider'));
}

async function handleOidcCallback(req, res) {
  const pendingLogin = req.session[SSO_SESSION_KEY];

  if (!pendingLogin || pendingLogin.provider !== 'oidc') {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoSessionExpired'));
  }

  if (req.query.error) {
    throw new Error(req.query.error_description || req.query.error);
  }

  const user = await findUserForSso(pendingLogin.email);

  if (!user || !isSsoEnabled(user.company) || user.company.sso_auth_provider !== 'oidc') {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoNotConfigured'));
  }

  const client = await getOidcClient(user.company);
  const params = client.callbackParams(req);
  const tokenSet = await client.callback(getOidcCallbackUrl(), params, {
    state: pendingLogin.state,
    nonce: pendingLogin.nonce,
    code_verifier: pendingLogin.codeVerifier,
  });

  const claims = tokenSet.claims();
  const ssoConfig = getSsoConfig(user.company);
  let oidcEmail = getOidcEmailFromClaims(user.company, claims);

  if (!oidcEmail && tokenSet.access_token) {
    const userInfo = await client.userinfo(tokenSet.access_token);
    oidcEmail = getOidcEmailFromClaims(user.company, userInfo);
  }

  if (!oidcEmail) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoEmailMissing'));
  }

  if (normalizeEmail(oidcEmail) !== normalizeEmail(pendingLogin.email)) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoEmailMismatch'));
  }

  if (validator.toBoolean(String(ssoConfig.require_verified_email)) && claims.email_verified === false) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoEmailNotVerified'));
  }

  req.session[OIDC_ID_TOKEN_SESSION_KEY] = tokenSet.id_token || null;

  return completeLogin(req, res, user, req.t('login.messages.ssoWelcomeBack', {
    name: user.name,
  }));
}

async function handleSamlCallback(req, res) {
  const pendingLogin = req.session[SSO_SESSION_KEY];

  if (!pendingLogin || pendingLogin.provider !== 'saml') {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoSessionExpired'));
  }

  if (!req.body.SAMLResponse) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoFailed'));
  }

  if (pendingLogin.relayState && req.body.RelayState && pendingLogin.relayState !== req.body.RelayState) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoStateMismatch'));
  }

  const user = await findUserForSso(pendingLogin.email);

  if (!user || !isSsoEnabled(user.company) || user.company.sso_auth_provider !== 'saml') {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoNotConfigured'));
  }

  const samlClient = getSamlClient(user.company);
  const validationResult = await samlClient.validatePostResponseAsync({
    SAMLResponse: req.body.SAMLResponse,
    RelayState: req.body.RelayState || '',
  });
  const samlEmail = getSamlEmailFromProfile(user.company, validationResult.profile || {});

  if (!samlEmail) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoEmailMissing'));
  }

  if (normalizeEmail(samlEmail) !== normalizeEmail(pendingLogin.email)) {
    return flashAndRedirectToLogin(req, res, req.t('login.messages.ssoEmailMismatch'));
  }

  return completeLogin(req, res, user, req.t('login.messages.ssoWelcomeBack', {
    name: user.name,
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
  getPublicSsoSummary,
  getResolvedSamlEntityId,
  getSsoConfig,
  getSamlMetadataUrl,
  handleOidcCallback,
  handleSamlCallback,
  isSsoEnabled,
  normalizeCertificate,
  performOidcLogout,
  renderSamlMetadata,
  startSsoLogin,
  validateSsoSettings,
};
