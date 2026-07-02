'use strict';

const expect = require('chai').expect;
const Sequelize = require('sequelize');

// Regression test for a class of bug where a migration creates a table with
// column names that don't match what the corresponding underscored:true
// model queries (e.g. `createdAt` in the migration vs `created_at` expected
// by the model). sequelize.sync({force:true}) based suites never exercise
// this: they build the schema from the models, bypassing migration SQL.
//
// This runs each migration's up() directly against a fresh sqlite database
// and then queries through the real model, the same way an app boot would.
describe('Reminder migration schema matches model expectations', function() {
  const cases = [
    {
      migration: '../../migrations/20260629000000-create-reminder-schedules.js',
      model: '../../lib/model/db/reminder_schedule.js',
      modelName: 'ReminderSchedule',
    },
    {
      migration: '../../migrations/20260505111000-create-leave-notifications.js',
      model: '../../lib/model/db/leave_notification.js',
      modelName: 'LeaveNotification',
    },
  ];

  cases.forEach(function(testCase) {
    it('lets ' + testCase.modelName + ' query the table its migration creates', async function() {
      const sequelize = new Sequelize('database', null, null, {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
      });

      const migration = require(testCase.migration);
      await migration.up(sequelize.getQueryInterface(), Sequelize);

      const Model = require(testCase.model)(sequelize, Sequelize.DataTypes);

      // Throws if the migration's columns don't match what the
      // (possibly underscored) model expects to select.
      const rows = await Model.findAll();
      expect(rows).to.be.an('array');

      await sequelize.close();
    });
  });
});
