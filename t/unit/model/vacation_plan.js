'use strict';

var expect = require('chai').expect,
  vacationPlan = require('../../../lib/model/vacation_plan');

describe('Vacation planning', function(){
  const buildPlan = function({id, userId, departmentId, start, end, status, groups}) {
    return {
      id,
      userId,
      status,
      date_start : start,
      date_end : end,
      leave_type : { name : 'Annual leave' },
      user : {
        name : 'User',
        lastname : String(userId),
        department : { id : departmentId, bossId : 7 },
        groups : groups || [],
      },
      is_submitted : function(){ return this.status === 1; },
      is_active : function(){ return [1, 2].indexOf(this.status) !== -1; },
    };
  };

  const criticalGroup = function({id, name, max}) {
    return {
      id,
      name,
      max_critical_overlap : max,
      UserGroup : { is_critical : true },
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
    expect(first.conflict_summary.status).to.equal('warning');
    expect(first.conflict_summary.department_count).to.equal(1);
    expect(first.conflict_summary.has_critical).to.equal(false);
  });

  it('marks overlapping critical plans as critical when group limit is reached', function(){
    const support = criticalGroup({id : 1, name : 'Support', max : 1});
    const first = buildPlan({
      id : 1,
      userId : 10,
      departmentId : 3,
      start : '2026-07-01',
      end : '2026-07-14',
      status : 2,
      groups : [support],
    });
    const second = buildPlan({
      id : 2,
      userId : 11,
      departmentId : 3,
      start : '2026-07-10',
      end : '2026-07-20',
      status : 1,
      groups : [support],
    });

    vacationPlan.attachConflicts([first, second]);

    expect(first.conflict_summary.status).to.equal('critical');
    expect(first.conflict_summary.critical_count).to.equal(1);
    expect(first.conflict_summary.blocking_critical_count).to.equal(1);
    expect(first.conflict_summary.has_blocking_critical).to.equal(true);
    expect(first.blocking_critical_conflict_groups[0].name).to.equal('Support');
    expect(first.blocking_critical_conflict_groups[0].conflicts[0].employee).to.equal('User 11');
  });

  it('detects critical overlaps across departments when users share a critical group', function(){
    const support = criticalGroup({id : 1, name : 'Support', max : 1});
    const first = buildPlan({
      id : 1,
      userId : 10,
      departmentId : 3,
      start : '2026-07-01',
      end : '2026-07-14',
      status : 2,
      groups : [support],
    });
    const second = buildPlan({
      id : 2,
      userId : 11,
      departmentId : 4,
      start : '2026-07-10',
      end : '2026-07-20',
      status : 1,
      groups : [support],
    });

    vacationPlan.attachConflicts([first, second]);

    expect(first.department_conflicts).to.deep.equal([]);
    expect(first.conflict_summary.status).to.equal('critical');
    expect(first.conflict_summary.has_conflicts).to.equal(true);
  });

  it('keeps critical group overlaps as warning while the limit still allows them', function(){
    const support = criticalGroup({id : 1, name : 'Support', max : 2});
    const first = buildPlan({
      id : 1,
      userId : 10,
      departmentId : 3,
      start : '2026-07-01',
      end : '2026-07-14',
      status : 2,
      groups : [support],
    });
    const second = buildPlan({
      id : 2,
      userId : 11,
      departmentId : 3,
      start : '2026-07-10',
      end : '2026-07-20',
      status : 1,
      groups : [support],
    });

    vacationPlan.attachConflicts([first, second]);

    expect(first.conflict_summary.status).to.equal('warning');
    expect(first.conflict_summary.has_critical).to.equal(true);
    expect(first.conflict_summary.has_blocking_critical).to.equal(false);
    expect(first.critical_conflict_groups[0].is_blocking).to.equal(false);
    expect(first.blocking_critical_conflict_groups).to.deep.equal([]);
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
