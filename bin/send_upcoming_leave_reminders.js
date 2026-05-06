'use strict';

var optimist = require('optimist').argv;

var models = require('../lib/model/db');
var EmailTransport = require('../lib/email');
var leaveReminder = require('../lib/model/leave/upcoming_leave_reminder');

var date = optimist.date || null;
var companyId = optimist.company_id ? Number(optimist.company_id) : null;

models.connect()
  .then(function() {
    return leaveReminder.sendLeaveStartReminders({
      models         : models,
      emailTransport : new EmailTransport(),
      date           : date,
      companyId      : companyId,
      daysBefore     : leaveReminder.LEAVE_START_REMINDER_DAYS,
    });
  })
  .then(function(notifications) {
    console.log('Sent leave start reminders: ' + notifications.length);
    notifications.forEach(function(notification) {
      console.log(
        'Leave #' + notification.leaveId
        + ' -> user #' + notification.recipientUserId
        + ' (' + notification.notificationType + ')'
      );
    });
  })
  .then(function() {
    return models.sequelize.close();
  })
  .catch(function(error) {
    console.error(
      'Failed to send upcoming leave reminders: '
      + (error && error.stack || error)
    );

    return models.sequelize.close()
      .catch(function() {})
      .then(function() {
        process.exit(1);
      });
  });
