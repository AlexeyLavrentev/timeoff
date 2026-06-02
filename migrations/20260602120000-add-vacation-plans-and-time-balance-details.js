'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.showAllTables()
      .then(function(tables) {
        if (tables.indexOf('VacationPlans') !== -1) {
          return 1;
        }

        return queryInterface.createTable('VacationPlans', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          status: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          date_start: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          date_end: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          employee_comment: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          approver_comment: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          decided_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          companyId: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          approverId: {
            type: Sequelize.INTEGER,
            allowNull: true,
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        });
      })
      .then(function() {
        return queryInterface.describeTable('TimeBalanceEntries');
      })
      .then(function(attributes) {
        if (attributes.hasOwnProperty('reason')) {
          return 1;
        }
        return queryInterface.addColumn('TimeBalanceEntries', 'reason', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'legacy',
        });
      })
      .then(function() {
        return queryInterface.describeTable('TimeBalanceEntries');
      })
      .then(function(attributes) {
        if (attributes.hasOwnProperty('expires_at')) {
          return 1;
        }
        return queryInterface.addColumn('TimeBalanceEntries', 'expires_at', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      })
      .then(function() {
        return queryInterface.describeTable('TimeBalanceEntries');
      })
      .then(function(attributes) {
        if (attributes.hasOwnProperty('reference')) {
          return 1;
        }
        return queryInterface.addColumn('TimeBalanceEntries', 'reference', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      })
      .then(function() {
        return queryInterface.describeTable('BankHolidays');
      })
      .then(function(attributes) {
        if (attributes.hasOwnProperty('import_source')) {
          return 1;
        }
        return queryInterface.addColumn('BankHolidays', 'import_source', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      });
  },

  down: function(queryInterface) {
    return queryInterface.removeColumn('BankHolidays', 'import_source')
      .then(function() {
        return queryInterface.removeColumn('TimeBalanceEntries', 'reference');
      })
      .then(function() {
        return queryInterface.removeColumn('TimeBalanceEntries', 'expires_at');
      })
      .then(function() {
        return queryInterface.removeColumn('TimeBalanceEntries', 'reason');
      })
      .then(function() {
        return queryInterface.dropTable('VacationPlans');
      });
  },
};
