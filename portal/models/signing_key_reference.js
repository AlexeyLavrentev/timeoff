'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const SigningKeyReference = sequelize.define('SigningKeyReference', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'file',
    },
    publicKeyPem: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    kmsKeyId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: 'signing_key_references',
    timestamps: true,
  });

  return SigningKeyReference;
};
