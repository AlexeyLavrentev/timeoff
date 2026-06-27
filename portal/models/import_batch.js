'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const ImportBatch = sequelize.define('ImportBatch', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    totalEntries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    importedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    skippedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    errorCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    dryRun: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    actorName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'import_batches',
    timestamps: true,
  });

  ImportBatch.associate = models => {
    ImportBatch.hasMany(models.License, { as: 'licenses', foreignKey: 'importBatchId' });
  };

  return ImportBatch;
};
