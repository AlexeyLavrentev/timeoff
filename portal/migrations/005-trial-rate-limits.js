'use strict';

const { hasTable } = require('./001-initial-schema');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await hasTable(queryInterface, 'trial_rate_limits')) return;

    const { DataTypes } = Sequelize;
    await queryInterface.createTable('trial_rate_limits', {
      id: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
      requestIpHash: { type: DataTypes.STRING(64), allowNull: false },
      windowStartedAt: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('trial_rate_limits', ['windowStartedAt'], {
      name: 'trial_rate_limits_window_started_at',
    });
  },

  down: async () => {
    throw new Error('Trial rate-limit migration is irreversible by design');
  },
};
