
"use strict"

const
  Promise   = require('bluebird'),
  Joi       = require('joi'),
  moment    = require('moment'),
  Exception = require('../../error'),
  {commentLeave} = require('../comment'),
  Models    = require('../db');

const
  schemaCreateNewLeave = Joi.object().required().keys({
    for_employee    : Joi.object().required(),
    of_type         : Joi.object().required(),
    with_parameters : Joi.object().required(),
    locale          : Joi.string().optional(),
  });

/*
 * Create new leave for provided parameters.
 * Returns promise that is resolved with newly created leave row
 * */
function createNewLeave(args){

  args = Joi.attempt(
    args,
    schemaCreateNewLeave,
    "Failed to validate arguments"
  );

  const
    employee          = args.for_employee,
    leave_type        = args.of_type,
    valide_attributes = args.with_parameters;

  const
    start_date = moment.utc(valide_attributes.from_date),
    end_date   = moment.utc(valide_attributes.to_date);

  // Check that start date is not bigger then end one
  if ( start_date.toDate() > end_date.toDate() ) {
    Exception.throwUserError({
      user_error   : "Start date is later than end date",
      system_error : `Failed to add new Leave for user ${ employee.id } `
        `because start date ${  start_date } happnned to be after end date ${ end_date }`,
    });
  }

  const comment = valide_attributes.reason,
    companyId = employee.companyId;

  // Make sure that booking to be created is not going to ovelap with
  // any existing bookings
  return Promise

    .try(() => employee.validate_overlapping(valide_attributes))
    .then(() => assertCriticalOverlapLimit({
      employee,
      start_date,
      end_date,
      locale: args.locale,
    }))
    .then(() => employee.promise_boss())
    .then(main_supervisor => {

      const new_leave_status = Models.Leave.does_skip_approval(employee, leave_type)
        ? Models.Leave.status_approved()
        : Models.Leave.status_new();

      // Following statement creates in memory only leave object
      // it is not in database until .save() method is called
      return Promise.resolve(Models.Leave.build({
        userId           : employee.id,
        leaveTypeId      : leave_type.id,
        status           : new_leave_status,
        approverId       : main_supervisor.id,
        employee_comment : valide_attributes.reason,

        date_start     : start_date.format('YYYY-MM-DD'),
        date_end       : end_date.format('YYYY-MM-DD'),
        day_part_start : valide_attributes.from_date_part,
        day_part_end   : valide_attributes.to_date_part,
      }));
    })

    .then(leave_to_create => employee
      .validate_leave_fits_into_remaining_allowance({
        year       : start_date,
        leave_type : leave_type,
        leave      : leave_to_create,
      })
      .then(() => leave_to_create.save())
    )
    .then(leave => commentLeaveIfNeeded({leave,comment,companyId}).then(() => leave))
    .then(leave => Promise.resolve(leave));
}

const { i18next, initI18next } = require('../../i18n');
initI18next();

const assertCriticalOverlapLimit = async ({ employee, start_date, end_date, leave_id_to_exclude, locale }) => {
  // Assumption: employee belongs to a single department; "critical" flag is stored on User.
  if (!employee.is_critical) {
    return Promise.resolve();
  }

  const department = await employee.getDepartment();

  if (!department || !department.max_critical_overlap) {
    return Promise.resolve();
  }

  const critical_users = await Models.User.findAll({
    where: {
      DepartmentId: department.id,
      is_critical: true,
    },
    attributes: ['id'],
  });

  if (critical_users.length === 0) {
    return Promise.resolve();
  }

  const critical_ids = critical_users.map(user => user.id);

  const overlap_filter = {
    userId: critical_ids,
    status: [
      Models.Leave.status_approved(),
      Models.Leave.status_new(),
      Models.Leave.status_pended_revoke(),
    ],
    date_start: { $lte: end_date.format('YYYY-MM-DD') },
    date_end: { $gte: start_date.format('YYYY-MM-DD') },
  };

  if (leave_id_to_exclude) {
    overlap_filter.id = { $ne: leave_id_to_exclude };
  }

  const overlapping_leaves = await Models.Leave.findAll({ where: overlap_filter });

  const unique_users = new Set(overlapping_leaves.map(leave => leave.userId));

  if (unique_users.size >= department.max_critical_overlap) {
    const error = new Error('Critical overlap limit exceeded');
    error.user_message = i18next.t('errors.criticalOverlapExceeded', { lng: locale || 'en' });
    throw error;
  }

  return Promise.resolve();
};

const commentLeaveIfNeeded = ({leave,comment, companyId}) => {
  return comment ? commentLeave({leave,comment,companyId}) : Promise.resolve();
};

const getLeaveForUserView = async ({actingUser, leaveId, dbModel}) => {

  const [leave] = await dbModel.Leave.findAll({
    where: {
      id: leaveId,
    },
    include: [{
      model: dbModel.User,
      as: 'user',
      where: {
        companyId: actingUser.companyId,
      }
    }],
  });

  if (!leave) {
    throw new Error(`User [${actingUser.id}] tried to access leave [${leaveId}] which does not belong to the same company.`);
  }

  return leave;
};

const doesUserHasExtendedViewOfLeave = async ({user, leave}) => {
  if (user.companyId !== (await leave.getUser()).companyId) {
    throw new Error(`User [${user.id}] and leave [${leave.id}] do not share company.`);
  }

  let extendedView = false;

  if (user.is_admin()) {
    extendedView = true;
  }

  if (! extendedView) {
    const reports = await user.promise_supervised_users();

    if (reports.filter(u => `${u.id}` === `${leave.userId}`).length > 0) {
      extendedView = true;
    }
  }

  return extendedView;
};

module.exports = {
  createNewLeave,
  assertCriticalOverlapLimit,
  doesUserHasExtendedViewOfLeave,
  getLeaveForUserView,
}
