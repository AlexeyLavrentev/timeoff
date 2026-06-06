"use strict";

const moment = require('moment');

const overlaps = (left, right) => (
  moment.utc(left.date_start).isSameOrBefore(moment.utc(right.date_end), 'day')
  && moment.utc(right.date_start).isSameOrBefore(moment.utc(left.date_end), 'day')
);

const fullName = user => {
  if (!user) {
    return '';
  }

  return typeof user.full_name === 'function'
    ? user.full_name()
    : `${user.name || ''} ${user.lastname || ''}`.trim();
};

const criticalGroupsFor = plan => {
  if (!plan || !plan.user || !plan.user.groups) {
    return [];
  }

  return plan.user.groups.filter(group => (
    group
    && group.UserGroup
    && group.UserGroup.is_critical
  ));
};

const sameGroup = (left, right) => String(left.id) === String(right.id);

const buildCriticalConflictGroups = ({plan, candidates}) => criticalGroupsFor(plan)
  .map(group => {
    const conflicts = candidates.filter(candidate => (
      criticalGroupsFor(candidate).some(candidateGroup => sameGroup(candidateGroup, group))
    ));

    if (conflicts.length === 0) {
      return null;
    }

    return {
      name      : group.name,
      max       : group.max_critical_overlap,
      count     : conflicts.length,
      is_blocking : conflicts.length >= group.max_critical_overlap,
      conflicts : conflicts.map(conflict => ({
        employee   : fullName(conflict.user),
        date_start : conflict.date_start,
        date_end   : conflict.date_end,
        leave_type : conflict.leave_type ? conflict.leave_type.name : null,
      })),
    };
  })
  .filter(Boolean);

const canActOnPlan = ({plan, actingUser}) => {
  if (!plan || !plan.is_submitted() || !plan.user || !plan.user.department) {
    return false;
  }

  if (String(plan.userId) === String(actingUser.id)) {
    return false;
  }

  return actingUser.is_admin()
    || String(plan.user.department.bossId) === String(actingUser.id);
};

const activeConflictsFor = ({plan, plans}) => plans.filter(candidate => (
    candidate.id !== plan.id
    && candidate.user
    && plan.user
    && candidate.is_active()
    && plan.is_active()
    && overlaps(plan, candidate)
  ));

const departmentConflictsFor = ({plan, plans}) => activeConflictsFor({plan, plans}).filter(candidate => (
    candidate.user
    && plan.user
    && candidate.user.department
    && plan.user.department
    && candidate.user.department.id === plan.user.department.id
  ));

const attachConflicts = plans => plans.map(plan => {
  const departmentConflicts = departmentConflictsFor({plan, plans});
  const activeConflicts = activeConflictsFor({plan, plans});
  const criticalConflictGroups = buildCriticalConflictGroups({
    plan,
    candidates : activeConflicts,
  });
  const blockingCriticalGroups = criticalConflictGroups.filter(group => group.is_blocking);
  const hasDepartmentConflicts = departmentConflicts.length > 0;
  const hasCriticalConflicts = criticalConflictGroups.length > 0;
  const hasBlockingCriticalConflicts = blockingCriticalGroups.length > 0;

  plan.conflicts = departmentConflicts;
  plan.department_conflicts = departmentConflicts;
  plan.critical_conflict_groups = criticalConflictGroups;
  plan.blocking_critical_conflict_groups = blockingCriticalGroups;
  plan.conflict_summary = {
    status           : hasBlockingCriticalConflicts
      ? 'critical'
      : hasDepartmentConflicts || hasCriticalConflicts
        ? 'warning'
        : 'none',
    department_count : departmentConflicts.length,
    critical_count   : criticalConflictGroups.length,
    blocking_critical_count : blockingCriticalGroups.length,
    has_department   : hasDepartmentConflicts,
    has_conflicts    : hasDepartmentConflicts || hasCriticalConflicts,
    has_critical     : hasCriticalConflicts,
    has_blocking_critical : hasBlockingCriticalConflicts,
  };

  return plan;
});

const promisePendingPlansFor = ({model, actingUser}) => model.VacationPlan.findAll({
  where : {
    companyId : actingUser.companyId,
    status : model.VacationPlan.status_submitted(),
  },
  include : [{
    model : model.User,
    as : 'user',
    include : [{ model : model.Department, as : 'department' }],
  }],
  order : [['createdAt', 'ASC']],
})
.then(plans => plans.filter(plan => canActOnPlan({plan, actingUser})));

module.exports = {
  overlaps,
  canActOnPlan,
  attachConflicts,
  criticalGroupsFor,
  promisePendingPlansFor,
};
