"use strict";

module.exports = function(sequelize, DataTypes) {
  const UserReplacement = sequelize.define("UserReplacement", {
    priority : {
      type         : DataTypes.INTEGER,
      allowNull    : false,
      defaultValue : 1,
    },
  }, {
    indexes : [{
      unique : true,
      fields : ['companyId', 'userId', 'replacementUserId'],
    }, {
      fields : ['companyId', 'userId'],
    }, {
      fields : ['replacementUserId'],
    }],

    classMethods : {
      associate : function(models) {
        UserReplacement.belongsTo(models.Company, {
          as         : 'company',
          foreignKey : 'companyId',
        });

        UserReplacement.belongsTo(models.User, {
          as         : 'user',
          foreignKey : 'userId',
        });

        UserReplacement.belongsTo(models.User, {
          as         : 'replacement',
          foreignKey : 'replacementUserId',
        });
      },
    },
  });

  return UserReplacement;
};
