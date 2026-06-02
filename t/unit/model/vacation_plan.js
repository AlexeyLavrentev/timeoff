'use strict';

var expect = require('chai').expect,
  vacationPlan = require('../../../lib/model/vacation_plan');

describe('Vacation planning', function(){
  const buildPlan = function({id, userId, departmentId, start, end, status}) {
    return {
      id,
      userId,
      status,
      date_start : start,
      date_end : end,
      user : { department : { id : departmentId, bossId : 7 } },
      is_submitted : function(){ return this.status === 1; },
      is_active : function(){ return [1, 2].indexOf(this.status) !== -1; },
    };
  };

  it('finds overlapping active plans inside one department', function(){
    const first = buildPlan({id : 1, userId : 10, departmentId : 3, start : '2026-07-01', end : '2026-07-14', status : 2});
    const second = buildPlan({id : 2, userId : 11, departmentId : 3, start : '2026-07-10', end : '2026-07-20', status : 1});
    const otherDepartment = buildPlan({id : 3, userId : 12, departmentId : 4, start : '2026-07-10', end : '2026-07-20', status : 2});

    vacationPlan.attachConflicts([first, second, otherDepartment]);

    expect(first.conflicts).to.deep.equal([second]);
    expect(second.conflicts).to.deep.equal([first]);
    expect(otherDepartment.conflicts).to.deep.equal([]);
  });

  it('allows the employee department boss to approve a submitted plan', function(){
    const plan = buildPlan({id : 1, userId : 10, departmentId : 3, start : '2026-07-01', end : '2026-07-14', status : 1});

    expect(vacationPlan.canActOnPlan({
      plan,
      actingUser : { id : 7, is_admin : function(){ return false; } },
    })).to.equal(true);
  });

  it('does not allow an employee to approve their own plan', function(){
    const plan = buildPlan({id : 1, userId : 10, departmentId : 3, start : '2026-07-01', end : '2026-07-14', status : 1});

    expect(vacationPlan.canActOnPlan({
      plan,
      actingUser : { id : 10, is_admin : function(){ return true; } },
    })).to.equal(false);
  });
});
