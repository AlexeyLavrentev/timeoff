'use strict';

var models = require('../lib/model/db');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.describeTable('Departments')
      .then(function(attributes){
        var tasks = [];

        if (!attributes.hasOwnProperty('notify_leave_start_reminder')) {
          tasks.push(queryInterface.addColumn(
            'Departments',
            'notify_leave_start_reminder',
            models.Department.attributes.notify_leave_start_reminder
          ));
        }

        if (!attributes.hasOwnProperty('notify_leave_start_reminder_to_employee')) {
          tasks.push(queryInterface.addColumn(
            'Departments',
            'notify_leave_start_reminder_to_employee',
            models.Department.attributes.notify_leave_start_reminder_to_employee
          ));
        }

        return Promise.all(tasks);
      });
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('Departments', 'notify_leave_start_reminder_to_employee'),
      queryInterface.removeColumn('Departments', 'notify_leave_start_reminder')
    ]);
  }
};
