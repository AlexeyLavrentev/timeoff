'use strict';

const expect = require('chai').expect;
const TeamView = require('../../../lib/model/team_view');

describe('Team view statistics', function(){
  it('deducts weekend days for leave types counted in calendar days', async function(){
    const leaveType = {
      id : 1,
      name : 'Annual leave',
      use_allowance : true,
      deduction_unit : 'calendar_days',
    };
    const teamView = new TeamView({user : {}});
    const details = {
      users_and_leaves : [{
        days : [{
          is_weekend : true,
          is_bank_holiday : false,
          is_leave_morning : true,
          is_leave_afternoon : true,
          morning_leave_type_id : leaveType.id,
          afternoon_leave_type_id : leaveType.id,
          leave_obj : {
            is_approved_leave : function(){ return true; },
          },
        }],
      }],
    };

    await teamView.inject_statistics({
      team_view_details : details,
      leave_types : [leaveType],
    });

    expect(details.users_and_leaves[0].statistics.deducted_days).to.equal(1);
    expect(details.users_and_leaves[0].statistics.leave_type_break_down.lite_version[leaveType.id]).to.equal(1);
  });
});
