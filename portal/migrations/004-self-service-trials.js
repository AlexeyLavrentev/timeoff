'use strict';

const { hasTable } = require('./001-initial-schema');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await hasTable(queryInterface, 'trial_requests')) return;

    const { DataTypes } = Sequelize;
    await queryInterface.createTable('trial_requests', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      normalizedEmail: { type: DataTypes.STRING(254), allowNull: false, unique: true },
      organizationName: { type: DataTypes.STRING(120), allowNull: false },
      contactName: { type: DataTypes.STRING(120), allowNull: true },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      tokenExpiresAt: { type: DataTypes.DATE, allowNull: false },
      requestIpHash: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      customerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'customers', key: 'id' },
      },
      licenseId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'licenses', key: 'id' },
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('trial_requests', ['requestIpHash', 'createdAt'], {
      name: 'trial_requests_ip_created_at',
    });
    await queryInterface.addIndex('trial_requests', ['status', 'tokenExpiresAt'], {
      name: 'trial_requests_status_expiry',
    });
  },

  down: async () => {
    throw new Error('Self-service trial migration is irreversible by design');
  },
};
