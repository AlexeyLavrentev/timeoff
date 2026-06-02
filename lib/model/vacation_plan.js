"use strict";

const moment = require('moment');

const overlaps = (left, right) => (
  moment.utc(left.date_start).isSameOrBefore(moment.utc(right.date_end), 'day')
  && moment.utc(right.date_start).isSameOrBefore(moment.utc(left.date_end), 'day')
);

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

const attachConflicts = plans => plans.map(plan => {
  plan.conflicts = plans.filter(candidate => (
    candidate.id !== plan.id
    && candidate.user
    && plan.user
    && candidate.user.department
    && plan.user.department
    && candidate.user.department.id === plan.user.department.id
    && candidate.is_active()
    && plan.is_active()
    && overlaps(plan, candidate)
  ));
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
  promisePendingPlansFor,
};
