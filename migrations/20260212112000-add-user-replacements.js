'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.showAllTables()
      .then(function(tables){
        if (tables.indexOf('UserReplacements') !== -1) {
          return 1;
        }

        return queryInterface.createTable('UserReplacements', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          companyId: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          replacementUserId: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          priority: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
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
        return queryInterface.addIndex('UserReplacements', {
          unique: true,
          fields: ['companyId', 'userId', 'replacementUserId'],
          name: 'UserReplacements_company_user_replacement_unique',
        });
      })
      .then(function() {
        return queryInterface.addIndex('UserReplacements', {
          fields: ['companyId', 'userId'],
          name: 'UserReplacements_company_user_idx',
        });
      })
      .then(function() {
        return queryInterface.addIndex('UserReplacements', {
          fields: ['replacementUserId'],
          name: 'UserReplacements_replacement_idx',
        });
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('UserReplacements');
  },
};
