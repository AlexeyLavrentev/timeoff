'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const description = await queryInterface.describeTable('admin_users');
    if (description.authRevision) return;

    await queryInterface.addColumn('admin_users', 'authRevision', {
      type: Sequelize.DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    const description = await queryInterface.describeTable('admin_users');
    if (description.authRevision) {
      await queryInterface.removeColumn('admin_users', 'authRevision');
    }
  },
};
