'use strict';

const expect = require('chai').expect;
const path = require('path');

const passportModulePath = path.resolve(__dirname, '../../lib/passport/index.js');
const dbModulePath = path.resolve(__dirname, '../../lib/model/db/index.js');
const tokenModulePath = path.resolve(__dirname, '../../lib/passport/getCompanyAdminByToken.js');

function loadPassportFactory() {
  const fakePassport = {
    strategies: [],
    serializeUserHandler: null,
    deserializeUserHandler: null,
    use(strategy) {
      this.strategies.push(strategy);
      return this;
    },
    serializeUser(handler) {
      this.serializeUserHandler = handler;
    },
    deserializeUser(handler) {
      this.deserializeUserHandler = handler;
    },
  };

  function FakeLocalStrategy(verify) {
    this.name = 'local';
    this._verify = verify;
  }

  function FakeBearerStrategy(verify) {
    this.name = 'bearer';
    this._verify = verify;
  }

  const originalPassport = require.cache[require.resolve('passport')];
  const originalPassportLocal = require.cache[require.resolve('passport-local')];
  const originalBearer = require.cache[require.resolve('passport-http-bearer')];
  const originalDb = require.cache[dbModulePath];
  const originalToken = require.cache[tokenModulePath];
  const originalModule = require.cache[passportModulePath];

  require.cache[require.resolve('passport')] = {
    exports: fakePassport,
  };
  require.cache[require.resolve('passport-local')] = {
    exports: {
      Strategy: FakeLocalStrategy,
    },
  };
  require.cache[require.resolve('passport-http-bearer')] = {
    exports: {
      Strategy: FakeBearerStrategy,
    },
  };
  require.cache[dbModulePath] = {
    exports: {
      User: {
        find_by_email() {
          throw new Error('find_by_email stub must be configured in test');
        },
      },
    },
  };
  require.cache[tokenModulePath] = {
    exports() {
      return Promise.reject(new Error('Not implemented in unit test'));
    },
  };

  delete require.cache[passportModulePath];

  try {
    const passportFactory = require(passportModulePath);

    return {
      passportFactory,
      fakePassport,
      restore() {
        if (originalPassport) {
          require.cache[require.resolve('passport')] = originalPassport;
        } else {
          delete require.cache[require.resolve('passport')];
        }

        if (originalPassportLocal) {
          require.cache[require.resolve('passport-local')] = originalPassportLocal;
        } else {
          delete require.cache[require.resolve('passport-local')];
        }

        if (originalBearer) {
          require.cache[require.resolve('passport-http-bearer')] = originalBearer;
        } else {
          delete require.cache[require.resolve('passport-http-bearer')];
        }

        if (originalDb) {
          require.cache[dbModulePath] = originalDb;
        } else {
          delete require.cache[dbModulePath];
        }

        if (originalToken) {
          require.cache[tokenModulePath] = originalToken;
        } else {
          delete require.cache[tokenModulePath];
        }

        if (originalModule) {
          require.cache[passportModulePath] = originalModule;
        } else {
          delete require.cache[passportModulePath];
        }
      },
    };
  } catch (error) {
    if (originalPassport) {
      require.cache[require.resolve('passport')] = originalPassport;
    } else {
      delete require.cache[require.resolve('passport')];
    }

    if (originalPassportLocal) {
      require.cache[require.resolve('passport-local')] = originalPassportLocal;
    } else {
      delete require.cache[require.resolve('passport-local')];
    }

    if (originalBearer) {
      require.cache[require.resolve('passport-http-bearer')] = originalBearer;
    } else {
      delete require.cache[require.resolve('passport-http-bearer')];
    }

    if (originalDb) {
      require.cache[dbModulePath] = originalDb;
    } else {
      delete require.cache[dbModulePath];
    }

    if (originalToken) {
      require.cache[tokenModulePath] = originalToken;
    } else {
      delete require.cache[tokenModulePath];
    }

    if (originalModule) {
      require.cache[passportModulePath] = originalModule;
    } else {
      delete require.cache[passportModulePath];
    }

    throw error;
  }
}

describe('Passport LDAP authentication', function() {
  it('closes LDAP connection only once after authenticate callback', function(done) {
    const loaded = loadPassportFactory();
    const passportFactory = loaded.passportFactory;
    const fakePassport = loaded.fakePassport;

    let closeCallCount = 0;
    let reloadCallCount = 0;
    let authCallback;

    const ldapServer = {
      authenticate(email, password, callback) {
        authCallback = callback;
      },
      close() {
        closeCallCount += 1;
      },
    };

    const user = {
      id: 42,
      email: 'ldap@example.com',
      company: {
        id: 7,
        ldap_auth_enabled: true,
        get_ldap_server() {
          return ldapServer;
        },
      },
      maybe_activate() {
        return Promise.resolve(user);
      },
      reload_with_session_details() {
        reloadCallCount += 1;
        return Promise.resolve(user);
      },
      getCompany() {
        return Promise.resolve(this.company);
      },
    };

    const dbModule = require.cache[dbModulePath].exports;
    dbModule.User.find_by_email = function(email) {
      expect(email).to.equal('ldap@example.com');
      return Promise.resolve(user);
    };

    passportFactory();

    const localStrategy = fakePassport.strategies.find(strategy => strategy.name === 'local');
    expect(localStrategy).to.exist;

    localStrategy._verify('ldap@example.com', 'secret', function(err, authenticatedUser, info) {
      loaded.restore();

      try {
        expect(err).to.equal(null);
        expect(info).to.equal(undefined);
        expect(authenticatedUser).to.equal(user);
        expect(reloadCallCount).to.equal(1);
        expect(closeCallCount).to.equal(1);
        done();
      } catch (assertionError) {
        done(assertionError);
      }
    });

    let attemptsLeft = 20;

    (function waitForAuthenticateCallback() {
      if (typeof authCallback === 'function') {
        try {
          authCallback(null, { uid: user.email });
        } catch (error) {
          loaded.restore();
          done(error);
        }
        return;
      }

      attemptsLeft -= 1;

      if (attemptsLeft <= 0) {
        loaded.restore();
        done(new Error('LDAP authenticate callback was not registered'));
        return;
      }

      setTimeout(waitForAuthenticateCallback, 5);
    }());
  });
});
