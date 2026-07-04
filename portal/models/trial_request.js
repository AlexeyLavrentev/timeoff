'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const TrialRequest = sequelize.define('TrialRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    normalizedEmail: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
    },
    organizationName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    contactName: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    requestIpHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'pending',
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
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
  }, {
    tableName: 'trial_requests',
    timestamps: true,
    indexes: [
      { fields: ['requestIpHash', 'createdAt'] },
      { fields: ['status', 'tokenExpiresAt'] },
    ],
  });

  TrialRequest.associate = models => {
    TrialRequest.belongsTo(models.Customer, { as: 'customer', foreignKey: 'customerId' });
    TrialRequest.belongsTo(models.License, { as: 'license', foreignKey: 'licenseId' });
  };

  return TrialRequest;
};
