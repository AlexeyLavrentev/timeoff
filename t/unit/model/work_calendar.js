'use strict';

var expect = require('chai').expect,
  workCalendar = require('../../../lib/model/work_calendar');

describe('Branch work calendar', function(){
  var commonHoliday = { id : 1, date : '2026-05-01', name : 'Common holiday', day_type : 'non_working' };
  var localHoliday = { id : 2, date : '2026-08-30', name : 'Local holiday', day_type : 'non_working', workCalendarId : 7 };
  var localWorkingOverride = { id : 3, date : '2026-05-01', name : 'Working override', day_type : 'working', workCalendarId : 7 };
  var otherCalendarHoliday = { id : 4, date : '2026-10-25', name : 'Other calendar', day_type : 'non_working', workCalendarId : 8 };

  it('uses company-wide holidays when department has no branch calendar', function(){
    expect(workCalendar.getNonWorkingDaysForDepartment({
      bankHolidays : [commonHoliday, localHoliday],
      department : {},
    })).to.deep.equal([commonHoliday]);
  });

  it('adds local days for the assigned branch calendar', function(){
    expect(workCalendar.getNonWorkingDaysForDepartment({
      bankHolidays : [commonHoliday, localHoliday, otherCalendarHoliday],
      department : { WorkCalendarId : 7 },
    })).to.deep.equal([commonHoliday, localHoliday]);
  });

  it('allows a local working day to override a company-wide holiday', function(){
    expect(workCalendar.getNonWorkingDaysForDepartment({
      bankHolidays : [commonHoliday, localWorkingOverride],
      department : { WorkCalendarId : 7 },
    })).to.deep.equal([]);
    expect(workCalendar.getWorkingDayOverridesForDepartment({
      bankHolidays : [commonHoliday, localWorkingOverride],
      department : { WorkCalendarId : 7 },
    })).to.deep.equal([localWorkingOverride]);
  });
});
