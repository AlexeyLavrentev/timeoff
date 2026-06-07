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

const toDayValue = date => moment.utc(date).startOf('day').valueOf();

const rangeFor = plan => ({
  start : toDayValue(plan.date_start),
  end   : toDayValue(plan.date_end),
});

const rangesOverlap = (left, right) => (
  left.start <= right.end
  && right.start <= left.end
);

const addToIndex = ({index, key, plan}) => {
  const normalizedKey = String(key);
  const indexedPlans = index.get(normalizedKey) || [];

  indexedPlans.push(plan);
  index.set(normalizedKey, indexedPlans);
};

const buildConflictIndexes = plans => {
  const metadata = new Map();
  const departments = new Map();
  const criticalGroups = new Map();

  plans.forEach(plan => {
    const groups = criticalGroupsFor(plan);
    const planMetadata = {
      active : plan.is_active(),
      criticalGroups : groups,
      range : rangeFor(plan),
    };

    metadata.set(plan, planMetadata);

    if (!planMetadata.active || !plan.user) {
      return;
    }

    if (plan.user.department) {
      addToIndex({
        index : departments,
        key   : plan.user.department.id,
        plan,
      });
    }

    groups.forEach(group => addToIndex({
      index : criticalGroups,
      key   : group.id,
      plan,
    }));
  });

  return {
    metadata,
    departments,
    criticalGroups,
  };
};

const findOverlappingPlans = ({plan, candidates, metadata}) => {
  const planMetadata = metadata.get(plan);

  if (!planMetadata || !planMetadata.active) {
    return [];
  }

  return candidates.filter(candidate => {
    const candidateMetadata = metadata.get(candidate);

    return candidate.id !== plan.id
      && candidate.user
      && plan.user
      && candidateMetadata
      && candidateMetadata.active
      && rangesOverlap(planMetadata.range, candidateMetadata.range);
  });
};

const buildCriticalConflictGroups = ({plan, indexes, includeDetails}) => {
  const planMetadata = indexes.metadata.get(plan);

  if (!planMetadata || !planMetadata.active) {
    return [];
  }

  return planMetadata.criticalGroups.map(group => {
    const candidates = indexes.criticalGroups.get(String(group.id)) || [];
    const conflicts = findOverlappingPlans({
      plan,
      candidates,
      metadata : indexes.metadata,
    });

    if (conflicts.length === 0) {
      return null;
    }

    return {
      name      : group.name,
      max       : group.max_critical_overlap,
      count     : conflicts.length,
      is_blocking : conflicts.length >= group.max_critical_overlap,
      conflicts : includeDetails
        ? conflicts.map(conflict => ({
          employee   : fullName(conflict.user),
          date_start : conflict.date_start,
          date_end   : conflict.date_end,
          leave_type : conflict.leave_type ? conflict.leave_type.name : null,
        }))
        : [],
    };
  })
  .filter(Boolean);
};

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

const departmentConflictsFromIndex = ({plan, indexes}) => {
  if (!plan.user || !plan.user.department) {
    return [];
  }

  return findOverlappingPlans({
    plan,
    candidates : indexes.departments.get(String(plan.user.department.id)) || [],
    metadata   : indexes.metadata,
  });
};

const attachConflicts = (plans, options) => {
  const includeDetails = !options || options.includeDetails !== false;
  const indexes = buildConflictIndexes(plans);

  return plans.map(plan => {
    const departmentConflicts = departmentConflictsFromIndex({plan, indexes});
    const criticalConflictGroups = buildCriticalConflictGroups({
      plan,
      indexes,
      includeDetails,
    });
    const blockingCriticalGroups = criticalConflictGroups.filter(group => group.is_blocking);
    const hasDepartmentConflicts = departmentConflicts.length > 0;
    const hasCriticalConflicts = criticalConflictGroups.length > 0;
    const hasBlockingCriticalConflicts = blockingCriticalGroups.length > 0;

    plan.conflicts = includeDetails ? departmentConflicts : [];
    plan.department_conflicts = includeDetails ? departmentConflicts : [];
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
};

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
