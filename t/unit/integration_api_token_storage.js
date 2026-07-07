'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const tokenSecurity = require('../../lib/auth/integration_api_token');
const defineCompany = require('../../lib/model/db/company');
const migration = require('../../migrations/20260707100000-hash-integration-api-tokens');

describe('Integration API token storage', function() {
  it('generates high-entropy tokens and stable SHA-256 hashes', function() {
    const first = tokenSecurity.generateToken();
    const second = tokenSecurity.generateToken();

    expect(first).to.have.length(43);
    expect(first).not.to.equal(second);
    expect(tokenSecurity.hashToken(first)).to.match(/^[a-f0-9]{64}$/);
    expect(tokenSecurity.hashToken(first)).to.equal(tokenSecurity.hashToken(first));
  });

  it('stores only a hash when regenerating a company token', function() {
    const sequelize = new Sequelize('sqlite::memory:', {logging: false});
    const Company = defineCompany(sequelize, Sequelize.DataTypes);
    const company = Company.build({name: 'Example', country: 'GB', start_of_new_year: 1});

    company.save = function() {
      return Promise.resolve(company);
    };

    return company.regenerateIntegrationApiToken().then(function(result) {
      expect(result.token).to.have.length(43);
      expect(result.company.get('integration_api_token_hash'))
        .to.equal(tokenSecurity.hashToken(result.token));
      expect(JSON.stringify(result.company.dataValues)).not.to.include(result.token);
      expect(result.company.get('integration_api_token')).to.equal(null);
    }).finally(function() {
      return sequelize.close();
    });
  });

  it('hashes bearer tokens before querying the database', function() {
    const sequelize = new Sequelize('sqlite::memory:', {logging: false});
    const Company = defineCompany(sequelize, Sequelize.DataTypes);
    const token = 'customer-bearer-token';
    let where;

    Company.scope = function() {
      return {
        findOne: function(options) {
          where = options.where;
          return Promise.resolve(null);
        },
      };
    };

    return Company.getCompanyByApiToken({token}).then(function() {
      expect(where.integration_api_token_hash).to.equal(tokenSecurity.hashToken(token));
      expect(where).not.to.have.property('integration_api_token');
    }).finally(function() {
      return sequelize.close();
    });
  });

  it('migrates existing tokens without changing their client value', async function() {
    const sequelize = new Sequelize('sqlite::memory:', {logging: false});
    const queryInterface = sequelize.getQueryInterface();
    const plaintext = '2deff8f2-38e5-43f9-a71e-7a239af1cf73';

    try {
      await queryInterface.createTable('Companies', {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        integration_api_token: {type: Sequelize.UUID, allowNull: false},
      });
      await queryInterface.bulkInsert('Companies', [{integration_api_token: plaintext}]);

      await migration.up(queryInterface, Sequelize);

      const rows = await sequelize.query(
        'SELECT integration_api_token, integration_api_token_hash FROM Companies',
        {type: Sequelize.QueryTypes.SELECT}
      );
      expect(rows[0].integration_api_token).to.equal(null);
      expect(rows[0].integration_api_token_hash).to.equal(tokenSecurity.hashToken(plaintext));
    } finally {
      await sequelize.close();
    }
  });

  it('never renders the stored hash and exposes a token only from one-time state', function() {
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'views', 'settings_company_integration_api.hbs'),
      'utf8'
    );

    expect(template).not.to.include('company.integration_api_token');
    expect(template).not.to.include('company.integration_api_token_hash');
    expect(template).to.include('{{accessToken}}');
    expect(template).to.include('tokenHidden');

    const route = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'route', 'settings.js'),
      'utf8'
    );
    expect(route).to.include('delete req.session.integration_api_token_once');
  });
});
