"use strict";
const { Op } = require('sequelize');

const moment = require('moment');

const LEAVE_START_REMINDER_DAYS = 14;
const NOTIFICATION_TYPE_SUPERVISOR = 'leave_start_reminder_supervisor';
const NOTIFICATION_TYPE_EMPLOYEE = 'leave_start_reminder_employee';

const approvedLeaveStatuses = models => ([
  models.Leave.status_approved(),
  models.Leave.status_pended_revoke(),
]);

const getReminderBaseDate = ({company, date}) => {
  if (date) {
    return moment.utc(date, 'YYYY-MM-DD');
  }

  return company.get_today().clone();
};

const getTargetLeaveStartDate = ({company, date, daysBefore}) => (
  getReminderBaseDate({company, date}).clone().add(daysBefore, 'days').format('YYYY-MM-DD')
);

const getLeaveRecipientNotifications = ({leave}) => {
  const notifications = [];
  const employee = leave.user;
  const department = employee && employee.department;
  const supervisor = department && department.boss;
  const isActiveRecipient = recipient => (
    recipient
    && recipient.email
    && (typeof recipient.is_active !== 'function' || recipient.is_active())
  );

  if (!employee || !department || !department.notify_leave_start_reminder) {
    return notifications;
  }

  if (isActiveRecipient(supervisor)) {
    notifications.push({
      recipient         : supervisor,
      employee          : employee,
      department        : department,
      notification_type : NOTIFICATION_TYPE_SUPERVISOR,
    });
  }

  if (department.notify_leave_start_reminder_to_employee && isActiveRecipient(employee)) {
    notifications.push({
      recipient         : employee,
      employee          : employee,
      department        : department,
      notification_type : NOTIFICATION_TYPE_EMPLOYEE,
    });
  }

  return notifications;
};

const getReminderLeaveSearch = ({models, company, targetLeaveStartDate}) => ({
  where : {
    status : { [Op.in] : approvedLeaveStatuses(models) },
    date_start : {
      [Op.gte] : targetLeaveStartDate,
      [Op.lt]  : moment.utc(targetLeaveStartDate, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD'),
    },
  },
  include : [{
    model    : models.User,
    as       : 'user',
    required : true,
    where    : Object.assign(
      { companyId : company.id },
      models.User.get_active_user_filter()
    ),
    include : [{
      model    : models.Company,
      as       : 'company',
      required : true,
    }, {
      model    : models.Department,
      as       : 'department',
      required : false,
      include  : [{
        model    : models.User,
        as       : 'boss',
        required : false,
      }],
    }],
  }, {
    model    : models.LeaveType,
    as       : 'leave_type',
    required : true,
  }],
});

const reserveReminderNotification = async ({
  models,
  leave,
  recipient,
  notificationType,
}) => {
  const leaveStartDate = moment.utc(leave.date_start).format('YYYY-MM-DD');

  const result = await models.LeaveNotification.findOrCreate({
    where : {
      notification_type : notificationType,
      leave_id          : leave.id,
      recipient_user_id : recipient.id,
      leave_start_date  : leaveStartDate,
    },
    defaults : {
      notification_type : notificationType,
      leave_id          : leave.id,
      recipient_user_id : recipient.id,
      company_id        : leave.user.companyId,
      leave_start_date  : leaveStartDate,
    },
  });

  return {
    notificationRecord : result[0],
    isNew              : result[1],
  };
};

const sendLeaveStartRemindersForCompany = async ({
  company,
  models,
  emailTransport,
  date,
  daysBefore,
}) => {
  const effectiveDaysBefore = Number(daysBefore || LEAVE_START_REMINDER_DAYS);
  const targetLeaveStartDate = getTargetLeaveStartDate({
    company,
    date,
    daysBefore : effectiveDaysBefore,
  });

  const leaves = await models.Leave.findAll(
    getReminderLeaveSearch({models, company, targetLeaveStartDate})
  );

  const sentNotifications = [];

  for (const leave of leaves) {
    const notifications = getLeaveRecipientNotifications({leave});

    for (const notification of notifications) {
      const reservation = await reserveReminderNotification({
        models,
        leave,
        recipient        : notification.recipient,
        notificationType : notification.notification_type,
      });

      if (!reservation.isNew) {
        continue;
      }

      try {
        await emailTransport.promise_upcoming_leave_start_reminder_email({
          leave,
          recipient         : notification.recipient,
          employee          : notification.employee,
          department        : notification.department,
          notification_type : notification.notification_type,
          daysBefore        : effectiveDaysBefore,
        });

        sentNotifications.push({
          leaveId          : leave.id,
          recipientUserId  : notification.recipient.id,
          notificationType : notification.notification_type,
          leaveStartDate   : targetLeaveStartDate,
        });
      } catch (error) {
        await reservation.notificationRecord.destroy();
        throw error;
      }
    }
  }

  return sentNotifications;
};

const sendLeaveStartReminders = async ({
  models,
  emailTransport,
  date,
  daysBefore,
  companyId,
}) => {
  const companySearch = {};

  if (companyId) {
    companySearch.where = { id : companyId };
  }

  const companies = await models.Company.findAll(companySearch);

  let sentNotifications = [];

  for (const company of companies) {
    const companyNotifications = await sendLeaveStartRemindersForCompany({
      company,
      models,
      emailTransport,
      date,
      daysBefore,
    });

    sentNotifications = sentNotifications.concat(companyNotifications);
  }

  return sentNotifications;
};

module.exports = {
  LEAVE_START_REMINDER_DAYS,
  NOTIFICATION_TYPE_EMPLOYEE,
  NOTIFICATION_TYPE_SUPERVISOR,
  getLeaveRecipientNotifications,
  getReminderBaseDate,
  getTargetLeaveStartDate,
  sendLeaveStartReminders,
  sendLeaveStartRemindersForCompany,
};
