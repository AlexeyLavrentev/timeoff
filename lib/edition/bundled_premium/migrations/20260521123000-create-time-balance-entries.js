'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.showAllTables()
      .then(function(tables){
        if (tables.indexOf('TimeBalanceEntries') !== -1) {
          return 1;
        }

        return queryInterface.createTable('TimeBalanceEntries', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          entry_type: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          status: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          hours: {
            type: Sequelize.FLOAT,
            allowNull: false,
          },
          date: {
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
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('TimeBalanceEntries');
  }
};
