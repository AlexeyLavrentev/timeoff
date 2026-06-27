'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const License = sequelize.define('License', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'customers', key: 'id' },
    },
    planId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'plans', key: 'id' },
    },
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    algorithm: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'RSA-SHA256',
    },
    payloadHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    licenseHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    licensePayload: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    actorName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    importBatchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'import_batches', key: 'id' },
    },
  }, {
    tableName: 'licenses',
    timestamps: true,
  });

  License.associate = models => {
    License.belongsTo(models.Customer, { as: 'customer', foreignKey: 'customerId' });
    License.belongsTo(models.Plan, { as: 'plan', foreignKey: 'planId' });
    License.belongsTo(models.ImportBatch, { as: 'importBatch', foreignKey: 'importBatchId' });
  };

  return License;
};
