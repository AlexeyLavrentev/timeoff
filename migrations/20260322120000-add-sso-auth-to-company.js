'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.describeTable('Companies')
      .then(function(attributes){
        var tasks = [];

        if (!attributes.hasOwnProperty('sso_auth_enabled')) {
          tasks.push(queryInterface.addColumn(
            'Companies',
            'sso_auth_enabled',
            models.Company.attributes.sso_auth_enabled
          ));
        }

        if (!attributes.hasOwnProperty('sso_auth_provider')) {
          tasks.push(queryInterface.addColumn(
            'Companies',
            'sso_auth_provider',
            models.Company.attributes.sso_auth_provider
          ));
        }

        if (!attributes.hasOwnProperty('sso_auth_config')) {
          tasks.push(queryInterface.addColumn(
            'Companies',
            'sso_auth_config',
            models.Company.attributes.sso_auth_config
          ));
        }

        return Promise.all(tasks);
      });
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('Companies', 'sso_auth_config'),
      queryInterface.removeColumn('Companies', 'sso_auth_provider'),
      queryInterface.removeColumn('Companies', 'sso_auth_enabled')
    ]);
  }
};
