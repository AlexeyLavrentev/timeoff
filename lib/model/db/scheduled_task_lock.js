"use strict";

module.exports = function(sequelize, DataTypes) {
  var ScheduledTaskLock = sequelize.define("ScheduledTaskLock", {
    task_name : {
      type      : DataTypes.STRING,
      allowNull : false,
      unique    : true,
    },
    locked_until : {
      type      : DataTypes.DATE,
      allowNull : false,
    },
    locked_by : {
      type      : DataTypes.STRING,
      allowNull : false,
    },
  }, {
    underscored     : true,
    freezeTableName : true,
    tableName       : 'ScheduledTaskLocks',
    timestamps      : true,
    indexes : [{
      unique : true,
      fields : ['task_name'],
    }],
  });

  return ScheduledTaskLock;
};
