'use strict';

const expect = require('chai').expect;

const flashMessages = require('../../../lib/middleware/flash_messages');
const settingsRouter = require('../../../lib/route/settings');
const ssoService = require('../../../lib/sso');

function getRouteHandler(path, method) {
  const layer = settingsRouter.stack.find(item =>
    item.route
    && item.route.path === path
    && item.route.methods
    && item.route.methods[method]
  );

  if (!layer) {
    throw new Error('Failed to find route handler for ' + method + ' ' + path);
  }

  return layer.route.stack[0].handle;
}

function createCompany(overrides) {
  const company = Object.assign({
    id: 101,
    ldap_auth_enabled: false,
    sso_auth_enabled: false,
    sso_auth_provider: null,
    ldap_auth_config: {},
    sso_auth_config: {},
    saveCallCount: 0,
    get(key) {
      return this[key];
    },
    set(key, value) {
      this[key] = value;
    },
    setDataValue(key, value) {
      this[key] = value;
    },
    save() {
      this.saveCallCount += 1;
      return Promise.resolve(this);
    },
    toJSON() {
      return {
        id: this.id,
        ldap_auth_enabled: this.ldap_auth_enabled,
        sso_auth_enabled: this.sso_auth_enabled,
        sso_auth_provider: this.sso_auth_provider,
        ldap_auth_config: this.ldap_auth_config,
        sso_auth_config: this.sso_auth_config,
      };
    },
  }, overrides || {});

  return company;
}

function createReq(body, company) {
  const req = {
    body: body || {},
    session: {},
    user: {
      email: 'admin@example.com',
      getCompany() {
        return Promise.resolve(company);
      },
    },
    t(key, options) {
      const opts = options || {};
      let message = key;

      if (opts.reason) {
        message += ' ' + String(opts.reason);
      }

      if (opts.domain) {
        message += ' ' + String(opts.domain);
      }

      return message;
    },
  };

  flashMessages(req, { locals: {} }, function() {});

  return req;
}

function invokeRoute(handler, req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for route response'));
    }, 500);

    const res = {
      locals: {
        custom_java_script: [],
        flash: null,
      },
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      redirect_with_session(location) {
        clearTimeout(timer);
        resolve({
          type: 'redirect',
          location: location,
          statusCode: this.statusCode,
          req: req,
          res: this,
        });
      },
      render(view, data) {
        clearTimeout(timer);
        resolve({
          type: 'render',
          view: view,
          data: data,
          statusCode: this.statusCode,
          req: req,
          res: this,
        });
      },
    };

    try {
      handler(req, res, reject);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

describe('Settings authentication route', function() {
  const postAuthenticationHandler = getRouteHandler('/company/authentication/', 'post');
  const originalValidateSsoSettings = ssoService.validateSsoSettings;

  afterEach(function() {
    ssoService.validateSsoSettings = originalValidateSsoSettings;
  });

  it('saves OIDC SSO settings after validation', async function() {
    const company = createCompany();
    let validatedCompany;

    ssoService.validateSsoSettings = function(targetCompany) {
      validatedCompany = targetCompany;
      return Promise.resolve();
    };

    const result = await invokeRoute(
      postAuthenticationHandler,
      createReq({
        sso_auth_enabled: 'on',
        sso_auth_provider: 'oidc',
        sso_login_alias: 'acme-oidc',
        sso_issuer_url: 'https://idp.example.com/realms/acme',
        sso_client_id: 'timeoff-web',
        sso_client_secret: 'super-secret',
        sso_scope: 'openid profile email',
        sso_email_claim: 'email',
        sso_require_verified_email: 'on',
        sso_email_domains: 'example.com example.org',
        sso_auto_create_users: 'on',
      }, company)
    );

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/settings/company/authentication/');
    expect(company.saveCallCount).to.equal(1);
    expect(validatedCompany).to.equal(company);
    expect(company.sso_auth_enabled).to.equal(true);
    expect(company.sso_auth_provider).to.equal('oidc');
    expect(company.sso_auth_config).to.deep.equal({
      login_alias: 'acme-oidc',
      issuer_url: 'https://idp.example.com/realms/acme',
      client_id: 'timeoff-web',
      client_secret: 'super-secret',
      scope: 'openid profile email',
      email_claim: 'email',
      require_verified_email: true,
      entry_point: '',
      idp_cert: '',
      identifier_format: '',
      email_attribute: 'email',
      email_domains: 'example.com example.org',
      auto_create_users: true,
      sp_entity_id: '',
    });
    expect(result.req.session.flash.messages[0]).to.equal('settings.messages.ssoUpdated');
  });

  it('saves SAML SSO settings after validation', async function() {
    const company = createCompany();
    let validatedCompany;

    ssoService.validateSsoSettings = function(targetCompany) {
      validatedCompany = targetCompany;
      return Promise.resolve();
    };

    const result = await invokeRoute(
      postAuthenticationHandler,
      createReq({
        sso_auth_enabled: 'on',
        sso_auth_provider: 'saml',
        sso_login_alias: 'acme-saml',
        sso_entry_point: 'https://idp.example.com/saml',
        sso_idp_cert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
        sso_identifier_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        sso_email_attribute: 'mail',
        sso_sp_entity_id: 'https://timeoff.example.com/saml/metadata',
        sso_email_domains: 'example.com',
      }, company)
    );

    expect(result.type).to.equal('redirect');
    expect(result.location).to.equal('/settings/company/authentication/');
    expect(company.saveCallCount).to.equal(1);
    expect(validatedCompany).to.equal(company);
    expect(company.sso_auth_enabled).to.equal(true);
    expect(company.sso_auth_provider).to.equal('saml');
    expect(company.sso_auth_config).to.deep.equal({
      login_alias: 'acme-saml',
      issuer_url: '',
      client_id: '',
      client_secret: '',
      scope: 'openid profile email',
      email_claim: 'email',
      require_verified_email: false,
      entry_point: 'https://idp.example.com/saml',
      idp_cert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
      identifier_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      email_attribute: 'mail',
      email_domains: 'example.com',
      auto_create_users: false,
      sp_entity_id: 'https://timeoff.example.com/saml/metadata',
    });
    expect(result.req.session.flash.messages[0]).to.equal('settings.messages.ssoUpdated');
  });

  it('rejects enabling LDAP and SSO together', async function() {
    const company = createCompany();
    let validateCalled = false;

    ssoService.validateSsoSettings = function() {
      validateCalled = true;
      return Promise.resolve();
    };

    const result = await invokeRoute(
      postAuthenticationHandler,
      createReq({
        ldap_auth_enabled: 'on',
        url: 'ldap://ldap.example.com:389',
        binddn: 'cn=admin,dc=example,dc=com',
        bindcredentials: 'secret',
        searchbase: 'dc=example,dc=com',
        password_to_check: '123456',
        sso_auth_enabled: 'on',
        sso_auth_provider: 'saml',
        sso_entry_point: 'https://idp.example.com/saml',
        sso_idp_cert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
      }, company)
    );

    expect(result.type).to.equal('render');
    expect(result.view).to.equal('settings_company_authentication');
    expect(result.statusCode).to.equal(422);
    expect(company.saveCallCount).to.equal(0);
    expect(validateCalled).to.equal(false);
    expect(result.req.session.flash.errors[0]).to.contain('settings.messages.authUpdateFailed');
    expect(result.req.session.flash.errors[0]).to.contain('settings.messages.authMutuallyExclusive');
  });
});
