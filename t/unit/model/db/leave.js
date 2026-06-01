
'use strict';

var expect  = require('chai').expect,
    _       = require('underscore'),
    model   = require('../../../../lib/model/db'),
    LeaveRequestParameters = require('../../../../lib/model/leave_request_parameters');

describe('Check bug when type mismatch happenned', function(){
    var leave = model.Leave.build({
        status : '1',
        date_start     : '2015-05-07 00:00:00.000 +00:00',
        day_part_start : 2,
        date_end     : '2015-05-07 00:00:00.000 +00:00',
        day_part_end : 2,
    });

    it('String value of 2 properly used', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-05-07',
                    from_date_part : '2',
                    to_date        : '2015-05-07',
                    // do not care about following parameters
                    to_date_part : 2,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.be.equal(false);
    });
});

describe('leave request half a day with existing booking of half a day', function(){
    var leave = model.Leave.build({
        status : '1',
        date_start : '2015-04-09',
        date_end : '2015-04-09',
        day_part_start : 2,
        day_part_end : 2,
    });

    it('clash', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-09',
                    from_date_part : 2,
                    to_date        : '2015-04-09',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('fit', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-09',
                    from_date_part : 3,
                    to_date        : '2015-04-09',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.be.ok;
    });
});

describe('Leave request is spread through more then one day', function(){
    var leave = model.Leave.build({
        status : '1',

        date_start     : '2015-04-09',
        date_end       : '2015-04-10',
        day_part_start : 2,
        day_part_end   : 1,
    });

    it('leave object is instanciated', function(){
        expect( leave ).to.be.ok;
    });

    it('both ends are full, stick to the start', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-08',
                    from_date_part : 1,
                    to_date        : '2015-04-09',
                    to_date_part   : 1,
                    // do not care about following parameters
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('both ends are full, stick to the end', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-10',
                    from_date_part : 1,
                    to_date        : '2015-04-11',
                    to_date_part   : 1,
                    // do not care about following parameters
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('ends with part stick to the part start - should fit', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-08',
                    from_date_part : 1,
                    to_date        : '2015-04-09',
                    to_date_part   : 3,
                    // do not care about following parameters
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.be.ok;
    });

    it('ends with part, stick to the part start - with clashes', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-08',
                    from_date_part : 1,
                    to_date        : '2015-04-09',
                    to_date_part   : 2,
                    // do not care about following parameters
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('start with with part, stick to the full end', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-10',
                    from_date_part : 2,
                    to_date        : '2015-04-11',
                    to_date_part   : 1,
                    // do not care about following parameters
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });
});

describe('Case when leave request is within one day', function(){

    var leave = model.Leave.build({
        status : '1',

        date_start     : '2015-04-09',
        date_end       : '2015-04-10',
        day_part_start : 2,
        day_part_end   : 1,
    });

    it('Is half and attempt to stick to the half day part so they fit', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-09',
                    from_date_part : 3,
                    to_date        : '2015-04-09',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.be.ok;
    });

    it('Is half and attempt to stick to the half day part with clashes', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-09',
                    from_date_part : 2,
                    to_date        : '2015-04-09',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('Is half and attempt to stick to the full day part', function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-10',
                    from_date_part : 2,
                    to_date        : '2015-04-10',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('Is full day and attempt to stick it to the half day part',function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-09',
                    from_date_part : 1,
                    to_date        : '2015-04-09',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

    it('Is full day and attempt to stick it to the full day part',function(){
        expect(
            leave.fit_with_leave_request(
                new LeaveRequestParameters( {
                    from_date      : '2015-04-10',
                    from_date_part : 1,
                    to_date        : '2015-04-10',
                    // do not care about following parameters
                    to_date_part : 1,
                    leave_type   : 1,
                    reason       : 1,
                })
            )
        ).to.not.be.ok;
    });

});

describe('Leave deducted days by deduction unit', function(){
    var schedule = {
      is_it_working_day : function(args) {
        return args.day.isoWeekday() < 6;
      },
    };

    var bank_holidays = [
      model.BankHoliday.build({
        name : 'Holiday',
        date : '2026-05-01',
      }),
    ];

    var user = model.User.build({
      name : 'Ivan',
      lastname : 'Ivanov',
      email : 'ivan@example.test',
      password : 'password',
    });

    user.cached_schedule = schedule;
    user.company = { bank_holidays : bank_holidays };

    var leave = model.Leave.build({
      status : model.Leave.status_approved(),
      date_start : '2026-05-01',
      date_end : '2026-05-04',
      day_part_start : model.Leave.leave_day_part_all(),
      day_part_end : model.Leave.leave_day_part_all(),
    });

    it('keeps existing working day deduction behavior', function(){
      var leave_type = model.LeaveType.build({
        name : 'Holiday',
        use_allowance : true,
        deduction_unit : 'working_days',
      });

      expect(
        leave.get_deducted_days_number({
          user : user,
          leave_type : leave_type,
        })
      ).to.be.equal(1);
    });

    it('counts weekends for calendar day deduction but excludes holidays', function(){
      var leave_type = model.LeaveType.build({
        name : 'Annual leave',
        use_allowance : true,
        deduction_unit : 'calendar_days',
      });

      expect(
        leave.get_deducted_days_number({
          user : user,
          leave_type : leave_type,
        })
      ).to.be.equal(3);
    });
});
