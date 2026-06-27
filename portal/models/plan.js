'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  }, {
    tableName: 'plans',
    timestamps: true,
  });

  Plan.associate = models => {
    Plan.hasMany(models.License, { as: 'licenses', foreignKey: 'planId' });
  };

  return Plan;
};
