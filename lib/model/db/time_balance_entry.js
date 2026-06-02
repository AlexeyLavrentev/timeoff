"use strict";

module.exports = function(sequelize, DataTypes) {
  const TimeBalanceEntry = sequelize.define("TimeBalanceEntry", {
    entry_type : {
      type      : DataTypes.STRING,
      allowNull : false,
    },
    status : {
      type         : DataTypes.INTEGER,
      allowNull    : false,
      defaultValue : 1,
    },
    hours : {
      type      : DataTypes.FLOAT,
      allowNull : false,
    },
    date : {
      type      : DataTypes.DATE,
      allowNull : false,
    },
    employee_comment : {
      type      : DataTypes.TEXT,
      allowNull : true,
    },
    reason : {
      type         : DataTypes.STRING,
      allowNull    : false,
      defaultValue : 'legacy',
    },
    expires_at : {
      type      : DataTypes.DATE,
      allowNull : true,
    },
    reference : {
      type      : DataTypes.STRING,
      allowNull : true,
    },
    approver_comment : {
      type      : DataTypes.TEXT,
      allowNull : true,
    },
    decided_at : {
      type      : DataTypes.DATE,
      allowNull : true,
    },
  }, {
    indexes : [
      { fields : ['companyId'] },
      { fields : ['userId'] },
      { fields : ['approverId'] },
      { fields : ['status'] },
    ],

    classMethods : {
      associate : function(models) {
        TimeBalanceEntry.belongsTo(models.Company, { as : 'company' });
        TimeBalanceEntry.belongsTo(models.User, { as : 'user', foreignKey : 'userId' });
        TimeBalanceEntry.belongsTo(models.User, { as : 'approver', foreignKey : 'approverId' });
      },

      entry_type_time_off : () => 'time_off',
      entry_type_worked_extra : () => 'worked_extra',

      status_new      : () => 1,
      status_approved : () => 2,
      status_rejected : () => 3,
      status_canceled : () => 4,
    },

    instanceMethods : {
      is_new : function() {
        return this.status === TimeBalanceEntry.status_new();
      },

      is_approved : function() {
        return this.status === TimeBalanceEntry.status_approved();
      },

      signed_hours : function() {
        return this.entry_type === TimeBalanceEntry.entry_type_time_off()
          ? -1 * this.hours
          : this.hours;
      },

      is_expired : function() {
        return this.entry_type === TimeBalanceEntry.entry_type_worked_extra()
          && this.expires_at
          && new Date(this.expires_at).getTime() < new Date().setHours(0, 0, 0, 0);
      },

      promise_to_approve : function(args) {
        if (!args || !args.by_user) {
          throw new Error('promise_to_approve has to have by_user parameter');
        }

        this.status = TimeBalanceEntry.status_approved();
        this.approverId = args.by_user.id;
        this.decided_at = new Date();
        this.approver_comment = args.comment || this.approver_comment;

        return this.save();
      },

      promise_to_reject : function(args) {
        if (!args || !args.by_user) {
          throw new Error('promise_to_reject has to have by_user parameter');
        }

        this.status = TimeBalanceEntry.status_rejected();
        this.approverId = args.by_user.id;
        this.decided_at = new Date();
        this.approver_comment = args.comment || this.approver_comment;

        return this.save();
      },
    },
  });

  return TimeBalanceEntry;
};
