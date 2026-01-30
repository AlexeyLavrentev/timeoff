'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.describeTable('Groups')
      .then(function(attributes){
        if (!attributes.hasOwnProperty('is_hr_group')) {
          return queryInterface.addColumn(
            'Groups',
            'is_hr_group',
            models.Group.attributes.is_hr_group
          );
        }
        return 1;
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Groups', 'is_hr_group');
  }
};
