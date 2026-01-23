'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {

    return queryInterface.describeTable('LeaveTypes').then(function(attributes){

      if (attributes.hasOwnProperty('minimum_consecutive_days')) {
        return 1;
      }

      return queryInterface.addColumn(
        'LeaveTypes',
        'minimum_consecutive_days',
        models.LeaveType.attributes.minimum_consecutive_days
      );
    });

  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('LeaveTypes', 'minimum_consecutive_days');
  }
};
