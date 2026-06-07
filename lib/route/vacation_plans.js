"use strict";

const express = require('express');
const moment = require('moment');
const validator = require('../util/validator');
const vacationPlan = require('../model/vacation_plan');
const { createNewLeave } = require('../model/leave');
const { getMinimumLeaveRequirementStatus } = require('../model/leave/minimum_leave_requirement');
const EmailTransport = require('../email');
const teamViewCache = require('../cache/team_view_cache');
const vacationPlanCache = require('../cache/vacation_plan_cache');
const { sorter } = require('../util');

const router = express.Router();

const findPlans = ({model, companyId, year}) => model.VacationPlan.findAll({
  attributes : [
    'id',
    'status',
    'date_start',
    'date_end',
    'employee_comment',
    'companyId',
    'userId',
    'leaveTypeId',
    'leaveId',
    'createdAt',
  ],
  where : {
    companyId,
    date_start : {
      $lte : moment.utc(`${year}-12-31`).endOf('day').toDate(),
    },
    date_end : {
      $gte : moment.utc(`${year}-01-01`).startOf('day').toDate(),
    },
  },
  include : [
    {
      model : model.User,
      as : 'user',
      attributes : ['id', 'name', 'lastname', 'companyId', 'DepartmentId'],
      include : [
        {
          model : model.Department,
          as : 'department',
          attributes : ['id', 'name', 'bossId'],
        },
        {
          model : model.Group,
          as : 'groups',
          attributes : ['id', 'name', 'max_critical_overlap'],
          through : { attributes : ['is_critical'] },
          required : false,
        },
      ],
    },
    {
      model : model.LeaveType,
      as : 'leave_type',
      attributes : ['id', 'name'],
    },
  ],
  order : [['date_start', 'ASC'], ['createdAt', 'ASC']],
});

const planStatus = {
  submitted : 1,
  approved : 2,
};

const decoratePlan = plan => {
  plan.is_submitted = function() {
    return this.status === planStatus.submitted;
  };
  plan.is_active = function() {
    return [planStatus.submitted, planStatus.approved].indexOf(this.status) !== -1;
  };
  plan.is_booked = function() {
    return !!this.leaveId;
  };

  return plan;
};

const decoratePlans = plans => plans.map(decoratePlan);

const plansToPlain = plans => plans.map(plan => (
  typeof plan.toJSON === 'function'
    ? plan.toJSON()
    : plan
));

const findPlansCached = async ({model, companyId, year}) => {
  const plans = await vacationPlanCache.getOrLoadPlans({
    companyId,
    year,
    load : async () => plansToPlain(await findPlans({model, companyId, year})),
  });

  return decoratePlans(plans);
};

const invalidateVacationPlanCache = companyId => vacationPlanCache.bumpCompanyVersion(companyId);

const normalizeDate = ({req, value}) => {
  const normalized = req.user.company.normalise_date(validator.trim(value || ''));

  if (!validator.isDate(normalized)) {
    throw new Error('Invalid date');
  }

  return moment.utc(normalized).format('YYYY-MM-DD');
};

router.get('/', async function(req, res) {
  const model = req.app.get('db_model');
  const year = validator.isNumeric(req.query['year'])
    ? Number(req.query['year'])
    : req.user.company.get_today().year();

  try {
    const [manageableUsers, company] = await Promise.all([
      req.user.promise_users_I_can_manage(),
      req.user.get_company_with_all_leave_types(),
    ]);
    manageableUsers
      .sort((a, b) => sorter(a.lastname, b.lastname));
    const manageableIds = new Set(manageableUsers.map(user => String(user.id)));
    const allPlans = vacationPlan.attachConflicts(await findPlansCached({
      model,
      companyId : req.user.companyId,
      year,
    }), { includeDetails : false });

    const myPlans = allPlans.filter(plan => String(plan.userId) === String(req.user.id));
    const pendingPlans = allPlans.filter(plan => (
      plan.is_submitted()
      && manageableIds.has(String(plan.userId))
      && vacationPlan.canActOnPlan({plan, actingUser : req.user})
    ));
    const teamPlans = allPlans.filter(plan => (
      manageableIds.has(String(plan.userId))
      && plan.is_active()
    ));

    return res.render('vacation_plans', {
      title : req.t('vacationPlans.title'),
      manageableUsers,
      leaveTypes : company.getSortedLeaveTypes(),
      myPlans,
      pendingPlans,
      teamPlans,
      year,
      yearPrev : year - 1,
      yearNext : year + 1,
    });
  } catch (error) {
    console.error(`Failed to load vacation plans for user [${req.user.id}]: ${error} at ${error.stack}`);
    req.session.flash_error(req.t('vacationPlans.messages.loadFailed'));
    return res.redirect_with_session('/');
  }
});

router.get('/conflicts/:planId/', async function(req, res) {
  const model = req.app.get('db_model');
  const planId = validator.trim(req.params['planId'] || '');

  if (!validator.isInt(planId)) {
    return res.status(400).send('');
  }

  try {
    const plan = await model.VacationPlan.findOne({
      attributes : ['id', 'date_start', 'companyId'],
      where : {
        id : planId,
        companyId : req.user.companyId,
      },
    });

    if (!plan) {
      return res.status(404).send('');
    }

    const plans = vacationPlan.attachConflicts(await findPlansCached({
      model,
      companyId : req.user.companyId,
      year : moment.utc(plan.date_start).year(),
    }));
    const planWithConflicts = plans.find(item => String(item.id) === String(planId));

    if (!planWithConflicts) {
      return res.status(404).send('');
    }

    return res.render('partials/vacation_plan_conflict_details', {
      layout : false,
      plan : planWithConflicts,
    });
  } catch (error) {
    console.error(`Failed to load vacation plan conflicts [${planId}] for user [${req.user.id}]: ${error} at ${error.stack}`);
    return res.status(500).send('');
  }
});

router.post('/create/', async function(req, res) {
  const model = req.app.get('db_model');
  const rawUserId = validator.trim(req.body['user_id'] || String(req.user.id));

  try {
    const manageableUsers = await req.user.promise_users_I_can_manage();
    const targetUser = manageableUsers.find(user => String(user.id) === String(rawUserId));
    const company = await req.user.get_company_with_all_leave_types();
    const leaveType = company.leave_types
      .find(type => String(type.id) === String(req.body['leave_type_id']));

    if (!targetUser) {
      req.session.flash_error(req.t('vacationPlans.messages.userInvalid'));
      return res.redirect_with_session('/vacation-plans/');
    }

    if (!leaveType) {
      req.session.flash_error(req.t('vacationPlans.messages.leaveTypeInvalid'));
      return res.redirect_with_session('/vacation-plans/');
    }

    const dateStart = normalizeDate({req, value : req.body['date_start']});
    const dateEnd = normalizeDate({req, value : req.body['date_end']});

    if (moment.utc(dateEnd).isBefore(moment.utc(dateStart), 'day')) {
      req.session.flash_error(req.t('vacationPlans.messages.dateRangeInvalid'));
      return res.redirect_with_session('/vacation-plans/');
    }

    await model.VacationPlan.create({
      status           : model.VacationPlan.status_submitted(),
      date_start       : dateStart,
      date_end         : dateEnd,
      employee_comment : validator.trim(req.body['employee_comment'] || ''),
      companyId        : req.user.companyId,
      userId           : targetUser.id,
      leaveTypeId      : leaveType.id,
    });
    await invalidateVacationPlanCache(req.user.companyId);

    req.session.flash_message(req.t('vacationPlans.messages.created'));
  } catch (error) {
    console.error(`Failed to create vacation plan for user [${req.user.id}]: ${error} at ${error.stack}`);
    req.session.flash_error(req.t('vacationPlans.messages.createFailed'));
  }

  return res.redirect_with_session('/vacation-plans/');
});

const planAction = ({statusMethod, messageKey}) => async function(req, res) {
  const model = req.app.get('db_model');
  const planId = validator.trim(req.body['plan_id'] || '');

  if (!validator.isInt(planId)) {
    req.session.flash_error(req.t('vacationPlans.messages.actionInvalid'));
    return res.redirect_with_session('/vacation-plans/');
  }

  try {
    const plan = await model.VacationPlan.findOne({
      where : { id : planId, companyId : req.user.companyId },
      include : [{
        model : model.User,
        as : 'user',
        include : [{ model : model.Department, as : 'department' }],
      }],
    });

    if (!vacationPlan.canActOnPlan({plan, actingUser : req.user})) {
      req.session.flash_error(req.t('vacationPlans.messages.actionForbidden'));
      return res.redirect_with_session('/vacation-plans/');
    }

    plan.status = model.VacationPlan[statusMethod]();
    plan.approverId = req.user.id;
    plan.decided_at = new Date();
    plan.approver_comment = validator.trim(req.body['approver_comment'] || '');
    await plan.save();
    await invalidateVacationPlanCache(req.user.companyId);

    req.session.flash_message(req.t(`vacationPlans.messages.${messageKey}`));
  } catch (error) {
    console.error(`Failed to process vacation plan [${planId}]: ${error} at ${error.stack}`);
    req.session.flash_error(req.t('vacationPlans.messages.actionFailed'));
  }

  return res.redirect_with_session('/vacation-plans/');
};

router.post('/approve/', planAction({statusMethod : 'status_approved', messageKey : 'approved'}));
router.post('/reject/', planAction({statusMethod : 'status_rejected', messageKey : 'rejected'}));

router.post('/cancel/', async function(req, res) {
  const model = req.app.get('db_model');
  const planId = validator.trim(req.body['plan_id'] || '');

  try {
    const plan = await model.VacationPlan.findOne({
      where : { id : planId, companyId : req.user.companyId, userId : req.user.id },
    });

    if (!plan || !plan.is_submitted()) {
      req.session.flash_error(req.t('vacationPlans.messages.actionForbidden'));
      return res.redirect_with_session('/vacation-plans/');
    }

    plan.status = model.VacationPlan.status_canceled();
    await plan.save();
    await invalidateVacationPlanCache(req.user.companyId);
    req.session.flash_message(req.t('vacationPlans.messages.canceled'));
  } catch (error) {
    console.error(`Failed to cancel vacation plan [${planId}]: ${error} at ${error.stack}`);
    req.session.flash_error(req.t('vacationPlans.messages.actionFailed'));
  }

  return res.redirect_with_session('/vacation-plans/');
});

router.post('/book/', async function(req, res) {
  const model = req.app.get('db_model');
  const planId = validator.trim(req.body['plan_id'] || '');

  try {
    const plan = await model.VacationPlan.findOne({
      where : { id : planId, companyId : req.user.companyId, userId : req.user.id },
      include : [{ model : model.LeaveType, as : 'leave_type' }],
    });

    if (!plan || plan.status !== model.VacationPlan.status_approved() || plan.is_booked()) {
      req.session.flash_error(req.t('vacationPlans.messages.bookForbidden'));
      return res.redirect_with_session('/vacation-plans/');
    }

    const company = await req.user.get_company_with_all_leave_types();
    const leaveTypeId = plan.leaveTypeId || validator.trim(req.body['leave_type_id'] || '');
    const leaveType = company.leave_types.find(type => String(type.id) === String(leaveTypeId));

    if (!leaveType) {
      req.session.flash_error(req.t('vacationPlans.messages.leaveTypeRequired'));
      return res.redirect_with_session('/vacation-plans/');
    }

    if (company.is_mode_readonly_holidays()) {
      req.session.flash_error(req.t('calendar.messages.companyLocked'));
      return res.redirect_with_session('/vacation-plans/');
    }

    const leave = await createNewLeave({
      for_employee : req.user,
      of_type : leaveType,
      with_parameters : {
        from_date : moment.utc(plan.date_start).format('YYYY-MM-DD'),
        from_date_part : model.Leave.leave_day_part_all(),
        to_date : moment.utc(plan.date_end).format('YYYY-MM-DD'),
        to_date_part : model.Leave.leave_day_part_all(),
        reason : plan.employee_comment || '',
      },
      locale : req.language || 'en',
    });

    plan.leaveTypeId = leaveType.id;
    plan.leaveId = leave.id;
    await plan.save();
    await invalidateVacationPlanCache(req.user.companyId);

    const loadedLeave = await leave.reloadWithAssociates();
    const warningStatus = await getMinimumLeaveRequirementStatus({
      user : loadedLeave.user,
      leaveType : loadedLeave.leave_type,
      year : moment.utc(loadedLeave.date_start),
    });

    if (warningStatus) {
      req.session.flash_warning(req.t('leaveWarnings.missingMinimumBlock', {
        year : warningStatus.year,
        days : warningStatus.requiredDays,
        leaveType : loadedLeave.leave_type.name,
      }));
    }

    await (new EmailTransport()).promise_leave_request_emails({ leave : loadedLeave });
    teamViewCache.bumpCompanyVersion(req.user.companyId);
    req.session.flash_message(req.t('vacationPlans.messages.booked'));
  } catch (error) {
    console.error(`Failed to book vacation plan [${planId}]: ${error} at ${error.stack}`);
    req.session.flash_error(req.t('vacationPlans.messages.bookFailed'));
    if (error.hasOwnProperty('user_message')) {
      req.session.flash_error(error.user_message);
    }
  }

  return res.redirect_with_session('/vacation-plans/');
});

module.exports = router;
