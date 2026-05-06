'use strict';

var expect = require('chai').expect;

var reminder = require('../../lib/model/leave/upcoming_leave_reminder');

describe('Upcoming leave reminder', function() {
  it('collects supervisor and employee recipients based on department settings', function() {
    var employee = { id : 10, email : 'employee@example.com' };
    var supervisor = { id : 20, email : 'boss@example.com' };
    var department = {
      name                                    : 'Operations',
      notify_leave_start_reminder             : true,
      notify_leave_start_reminder_to_employee : true,
      boss                                    : supervisor,
    };

    employee.department = department;

    var notifications = reminder.getLeaveRecipientNotifications({
      leave : { user : employee }
    });

    expect(notifications).to.have.length(2);
    expect(notifications[0].recipient.id).to.equal(supervisor.id);
    expect(notifications[1].recipient.id).to.equal(employee.id);
  });

  it('does not collect recipients when reminder is disabled on department', function() {
    var employee = {
      id         : 10,
      email      : 'employee@example.com',
      department : {
        notify_leave_start_reminder             : false,
        notify_leave_start_reminder_to_employee : true,
        boss                                    : { id : 20, email : 'boss@example.com' },
      },
    };

    var notifications = reminder.getLeaveRecipientNotifications({
      leave : { user : employee }
    });

    expect(notifications).to.have.length(0);
  });

  it('sends reminders only once per leave and recipient', async function() {
    var leave = {
      id         : 7,
      date_start : '2026-06-19',
      status     : 2,
      leave_type : { name : 'Vacation' },
      user       : {
        id         : 10,
        email      : 'employee@example.com',
        companyId  : 55,
        company    : { id : 55 },
        department : {
          name                                    : 'Operations',
          notify_leave_start_reminder             : true,
          notify_leave_start_reminder_to_employee : false,
          boss                                    : {
            id    : 20,
            email : 'boss@example.com',
            record_email_addressed_to_me : function() {
              return Promise.resolve();
            },
          },
        },
      },
    };

    var createCalls = 0;
    var sentCalls = 0;

    var models = {
      Leave : {
        status_approved      : function() { return 2; },
        status_pended_revoke : function() { return 4; },
        findAll              : function() { return Promise.resolve([leave]); },
      },
      User : {
        get_active_user_filter : function() { return {}; },
      },
      Company : {
        findAll : function() {
          return Promise.resolve([{
            id        : 55,
            get_today : function() {
              return require('moment').utc('2026-06-05', 'YYYY-MM-DD');
            },
          }]);
        },
      },
      LeaveNotification : {
        findOrCreate : function() {
          createCalls += 1;

          if (createCalls === 1) {
            return Promise.resolve([{
              destroy : function() { return Promise.resolve(); },
            }, true]);
          }

          return Promise.resolve([{
            destroy : function() { return Promise.resolve(); },
          }, false]);
        },
      },
    };

    var emailTransport = {
      promise_upcoming_leave_start_reminder_email : function() {
        sentCalls += 1;
        return Promise.resolve();
      },
    };

    var firstRun = await reminder.sendLeaveStartReminders({
      models         : models,
      emailTransport : emailTransport,
      date           : '2026-06-05',
    });

    var secondRun = await reminder.sendLeaveStartReminders({
      models         : models,
      emailTransport : emailTransport,
      date           : '2026-06-05',
    });

    expect(firstRun).to.have.length(1);
    expect(secondRun).to.have.length(0);
    expect(sentCalls).to.equal(1);
  });
});
