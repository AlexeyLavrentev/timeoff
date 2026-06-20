'use strict';

var argv = require('minimist')(process.argv.slice(2));

var models = require('../lib/model/db');
var EmailTransport = require('../lib/email');
var features = require('../lib/features');
var leaveReminder = require('../lib/model/leave/upcoming_leave_reminder');

var date = argv.date || null;
var companyId = argv.company_id ? Number(argv.company_id) : null;

if (!features.isEnabled('leave_start_reminders')) {
  console.log('Leave start reminders feature disabled');
  process.exit(0);
}

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
