"use strict";

module.exports = function(sequelize, DataTypes) {
  const Group = sequelize.define("Group", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    max_critical_overlap: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    is_hr_group: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    indexes: [
      { fields: ['companyId'] },
      { fields: ['name'] },
    ],
    classMethods: {
      associate: function(models) {
        Group.belongsTo(models.Company, { as: 'company' });
        Group.belongsToMany(models.User, {
          as: 'users',
          through: models.UserGroup,
          foreignKey: 'groupId',
          otherKey: 'userId',
        });
      },
      default_order_field: function() {
        return 'name';
      },
    },
  });

  return Group;
};
