'use strict';

const tokenSecurity = require('../lib/auth/integration_api_token');

module.exports = {
  up: async function(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Companies');

    if (!columns.integration_api_token_hash) {
      await queryInterface.addColumn('Companies', 'integration_api_token_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    if (columns.integration_api_token) {
      await queryInterface.changeColumn('Companies', 'integration_api_token', {
        type: Sequelize.UUID,
        allowNull: true,
      });

      const companies = await queryInterface.sequelize.query(
        'SELECT id, integration_api_token FROM '
          + queryInterface.queryGenerator.quoteTable('Companies'),
        {type: Sequelize.QueryTypes.SELECT}
      );

      for (const company of companies) {
        if (company.integration_api_token) {
          await queryInterface.bulkUpdate('Companies', {
            integration_api_token_hash: tokenSecurity.hashToken(company.integration_api_token),
            integration_api_token: null,
          }, {id: company.id});
        }
      }

    }

    await queryInterface.changeColumn('Companies', 'integration_api_token_hash', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });
  },

  down: function() {
    // Plaintext tokens cannot be reconstructed from their hashes.
    return Promise.resolve();
  },
};
