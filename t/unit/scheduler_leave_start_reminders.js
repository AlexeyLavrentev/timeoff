'use strict';

var expect = require('chai').expect;

var scheduler = require('../../lib/scheduler/leave_start_reminders');

describe('Leave start reminder scheduler', function() {
  it('calculates next run today when schedule time is still ahead', function() {
    var nextRunAt = scheduler.getNextRunAt({
      now          : new Date('2026-05-08T08:30:00Z'),
      scheduleTime : '09:00',
      timezone     : 'UTC',
    });

    expect(nextRunAt.toISOString()).to.equal('2026-05-08T09:00:00.000Z');
  });

  it('calculates next run tomorrow when schedule time already passed', function() {
    var nextRunAt = scheduler.getNextRunAt({
      now          : new Date('2026-05-08T09:30:00Z'),
      scheduleTime : '09:00',
      timezone     : 'UTC',
    });

    expect(nextRunAt.toISOString()).to.equal('2026-05-09T09:00:00.000Z');
  });

  it('skips job when DB task lock is already held', async function() {
    var findOneCalls = 0;
    var emailCalls = 0;

    var models = {
      ScheduledTaskLock : {
        findOne : function() {
          findOneCalls += 1;
          return Promise.resolve({
            locked_until : new Date('2099-01-01T00:00:00Z'),
          });
        },
      },
    };

    var result = await scheduler.runLeaveReminderJob({
      models,
      emailTransport : {
        promise_upcoming_leave_start_reminder_email : function() {
          emailCalls += 1;
          return Promise.resolve();
        },
      },
      logger : {
        log   : function() {},
        error : function() {},
      },
    });

    expect(findOneCalls).to.equal(1);
    expect(emailCalls).to.equal(0);
    expect(result.skipped).to.equal(true);
  });
});
