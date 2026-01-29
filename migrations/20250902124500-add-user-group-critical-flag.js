'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.describeTable('UserGroups')
      .then(function(attributes){
        if (!attributes.hasOwnProperty('is_critical')) {
          return queryInterface.addColumn(
            'UserGroups',
            'is_critical',
            models.UserGroup.attributes.is_critical
          );
        }
        return 1;
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('UserGroups', 'is_critical');
  },
};
