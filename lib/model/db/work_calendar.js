"use strict";

module.exports = function(sequelize, DataTypes) {
  const WorkCalendar = sequelize.define("WorkCalendar", {
    name : {
      type      : DataTypes.STRING,
      allowNull : false,
    },
  }, {
    indexes : [
      { fields : ['companyId'] },
    ],

    
  });

  
    WorkCalendar.associate = function(models) {
        WorkCalendar.belongsTo(models.Company, { as : 'company' });
        WorkCalendar.hasMany(models.Department, {
          as         : 'departments',
          foreignKey : 'WorkCalendarId',
        });
        WorkCalendar.hasMany(models.BankHoliday, {
          as         : 'bank_holidays',
          foreignKey : 'workCalendarId',
        });
      };

return WorkCalendar;
};
