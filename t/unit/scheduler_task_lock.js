'use strict';

var expect = require('chai').expect;

var taskLock = require('../../lib/scheduler/task_lock');

describe('Scheduler task lock', function() {
  it('creates lock when task was never locked before', async function() {
    var createPayload;

    var result = await taskLock.tryAcquireTaskLock({
      taskName : 'example',
      lockedBy : 'test-owner',
      now      : new Date('2026-05-08T09:00:00Z'),
      models   : {
        ScheduledTaskLock : {
          findOne : function() {
            return Promise.resolve(null);
          },
          create : function(payload) {
            createPayload = payload;
            return Promise.resolve(payload);
          },
        },
      },
    });

    expect(result.acquired).to.equal(true);
    expect(createPayload.task_name).to.equal('example');
    expect(createPayload.locked_by).to.equal('test-owner');
  });

  it('does not acquire non-expired lock', async function() {
    var result = await taskLock.tryAcquireTaskLock({
      taskName : 'example',
      lockedBy : 'test-owner',
      now      : new Date('2026-05-08T09:00:00Z'),
      models   : {
        ScheduledTaskLock : {
          findOne : function() {
            return Promise.resolve({
              locked_until : new Date('2026-05-08T09:30:00Z'),
              locked_by    : 'other-owner',
            });
          },
        },
      },
    });

    expect(result.acquired).to.equal(false);
  });

  it('acquires expired lock by extending it', async function() {
    var updateCalls = 0;
    var lock = {
      locked_until : new Date('2026-05-08T08:00:00Z'),
      locked_by    : 'old-owner',
    };
    var findOneCalls = 0;

    var result = await taskLock.tryAcquireTaskLock({
      taskName : 'example',
      lockedBy : 'new-owner',
      now      : new Date('2026-05-08T09:00:00Z'),
      models   : {
        ScheduledTaskLock : {
          findOne : function() {
            findOneCalls += 1;
            return Promise.resolve(lock);
          },
          update : function(payload) {
            updateCalls += 1;
            lock.locked_until = payload.locked_until;
            lock.locked_by = payload.locked_by;

            return Promise.resolve([1]);
          },
        },
      },
    });

    expect(result.acquired).to.equal(true);
    expect(lock.locked_by).to.equal('new-owner');
    expect(findOneCalls).to.equal(2);
    expect(updateCalls).to.equal(1);
  });
});
