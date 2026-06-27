'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const Customer = sequelize.define('Customer', {
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
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'customers',
    timestamps: true,
  });

  Customer.associate = models => {
    Customer.hasMany(models.License, { as: 'licenses', foreignKey: 'customerId' });
  };

  return Customer;
};
