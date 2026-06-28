'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    let description;
    try {
      description = await queryInterface.describeTable('licenses');
    } catch (_error) {
      return;
    }

    if (description.metadata) return;

    await queryInterface.addColumn('licenses', 'metadata', {
      type: Sequelize.DataTypes.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    const description = await queryInterface.describeTable('licenses');
    if (description.metadata) {
      await queryInterface.removeColumn('licenses', 'metadata');
    }
  },
};
