"use strict";

module.exports = function(sequelize, DataTypes) {
  const VacationPlan = sequelize.define("VacationPlan", {
    status : {
      type         : DataTypes.INTEGER,
      allowNull    : false,
      defaultValue : 1,
    },
    date_start : {
      type      : DataTypes.DATE,
      allowNull : false,
    },
    date_end : {
      type      : DataTypes.DATE,
      allowNull : false,
    },
    employee_comment : {
      type      : DataTypes.TEXT,
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

    

    
  });

  
    VacationPlan.associate = function(models) {
        VacationPlan.belongsTo(models.Company, { as : 'company' });
        VacationPlan.belongsTo(models.User, { as : 'user', foreignKey : 'userId' });
        VacationPlan.belongsTo(models.User, { as : 'approver', foreignKey : 'approverId' });
        VacationPlan.belongsTo(models.LeaveType, { as : 'leave_type', foreignKey : 'leaveTypeId' });
        VacationPlan.belongsTo(models.Leave, { as : 'leave', foreignKey : 'leaveId' });
      };

    VacationPlan.status_submitted = () => 1;

    VacationPlan.status_approved = () => 2;

    VacationPlan.status_rejected = () => 3;

    VacationPlan.status_canceled = () => 4;

    VacationPlan.prototype.is_submitted = function() {
        return this.status === VacationPlan.status_submitted();
      };

    VacationPlan.prototype.is_active = function() {
        return [
          VacationPlan.status_submitted(),
          VacationPlan.status_approved(),
        ].indexOf(this.status) !== -1;
      };

    VacationPlan.prototype.is_booked = function() {
        return !!this.leaveId;
      };

return VacationPlan;
};
