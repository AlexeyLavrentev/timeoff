'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.describeTable('Groups')
      .then(function(attributes){
        if (!attributes.hasOwnProperty('max_critical_overlap')) {
          return queryInterface.addColumn(
            'Groups',
            'max_critical_overlap',
            models.Group.attributes.max_critical_overlap
          );
        }
        return 1;
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Groups', 'max_critical_overlap');
  },
};
