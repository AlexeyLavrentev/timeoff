"use strict";

module.exports = function(sequelize, DataTypes) {
  const UserGroup = sequelize.define("UserGroup", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_critical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    indexes: [
      { fields: ['userId'] },
      { fields: ['groupId'] },
    ],
    classMethods: {
      associate: function(models) {
        UserGroup.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
        UserGroup.belongsTo(models.Group, { as: 'group', foreignKey: 'groupId' });
      },
    },
  });

  return UserGroup;
};
