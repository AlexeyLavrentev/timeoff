'use strict';

const { DataTypes } = require('sequelize');

const VALID_ROLES = ['viewer', 'issuer', 'admin'];

module.exports = sequelize => {
  const AdminUser = sequelize.define('AdminUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'viewer',
      validate: {
        isIn: [VALID_ROLES],
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failedLoginCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'admin_users',
    timestamps: true,
  });

  AdminUser.associate = () => {};

  AdminUser.prototype.toSafeJSON = function() {
    const { passwordHash, ...safe } = this.toJSON();
    return safe;
  };

  return AdminUser;
};

module.exports.VALID_ROLES = VALID_ROLES;
