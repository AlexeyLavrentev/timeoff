'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {

    return queryInterface.describeTable('LeaveTypes').then(function(attributes){

      if (attributes.hasOwnProperty('deduction_unit')) {
        return 1;
      }

      return queryInterface.addColumn(
        'LeaveTypes',
        'deduction_unit',
        models.LeaveType.attributes.deduction_unit
      );
    });

  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('LeaveTypes', 'deduction_unit');
  }
};
