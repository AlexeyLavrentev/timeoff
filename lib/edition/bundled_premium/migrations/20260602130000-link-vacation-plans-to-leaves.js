'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.describeTable('VacationPlans')
      .then(function(attributes) {
        if (attributes.hasOwnProperty('leaveTypeId')) {
          return 1;
        }

        return queryInterface.addColumn('VacationPlans', 'leaveTypeId', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      })
      .then(function() {
        return queryInterface.describeTable('VacationPlans');
      })
      .then(function(attributes) {
        if (attributes.hasOwnProperty('leaveId')) {
          return 1;
        }

        return queryInterface.addColumn('VacationPlans', 'leaveId', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      });
  },

  down: function(queryInterface) {
    return queryInterface.removeColumn('VacationPlans', 'leaveId')
      .then(function() {
        return queryInterface.removeColumn('VacationPlans', 'leaveTypeId');
      });
  },
};
