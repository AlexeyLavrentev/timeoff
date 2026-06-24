'use strict';

var expect = require('chai').expect;
var EditionRegistry = require('../../lib/edition/registry');

describe('Leave event dispatch', function() {
  it('dispatchLeaveEvent is a no-op when no dispatcher registered', function() {
    var edition = require('../../lib/edition');
    // Should not throw even without a dispatcher
    edition.dispatchLeaveEvent({type: 'submitted', leave: {id: 1}});
  });

  it('registry returns null when no dispatcher registered', function() {
    var registry = new EditionRegistry();
    expect(registry.getLeaveEventDispatcher()).to.equal(null);
  });

  it('dispatcher with sync throw does not propagate through registry', function() {
    var registry = new EditionRegistry();
    var dispatched = [];

    registry.registerLeaveEventDispatcher({
      dispatch: function(args) {
        if (args.type === 'explode') {
          throw new Error('boom');
        }
        dispatched.push(args.type);
      },
    });

    var dispatcher = registry.getLeaveEventDispatcher();

    expect(function() {
      dispatcher.dispatch({type: 'submitted', leave: {}});
    }).to.not.throw();

    expect(dispatched).to.deep.equal(['submitted']);
  });

  it('dispatchLeaveEvent swallows sync throw from dispatcher', function() {
    var edition = require('../../lib/edition');
    var registry = edition.getRegistry();

    registry.registerLeaveEventDispatcher({
      dispatch: function() {
        throw new Error('sync boom');
      },
    });

    // Should not throw — fire-and-forget swallows errors
    expect(function() {
      edition.dispatchLeaveEvent({type: 'approve', leave: {id: 99}});
    }).to.not.throw();

    // Clean up — set dispatcher to null by using internal property
    registry._leaveEventDispatcher = null;
  });

  it('dispatchLeaveEvent swallows rejected promise from dispatcher', function(done) {
    var edition = require('../../lib/edition');
    var registry = edition.getRegistry();
    var origError = console.error;
    var logged = [];

    console.error = function(msg) { logged.push(msg); };

    registry.registerLeaveEventDispatcher({
      dispatch: function() {
        return Promise.reject(new Error('async boom'));
      },
    });

    expect(function() {
      edition.dispatchLeaveEvent({type: 'reject', leave: {id: 5}});
    }).to.not.throw();

    // Give the unhandled rejection handler time to fire
    setTimeout(function() {
      console.error = origError;
      // The error was logged (swallowed), not thrown
      var found = logged.some(function(msg) {
        return msg.indexOf('async boom') !== -1;
      });
      expect(found).to.equal(true);

      // Clean up — set dispatcher to null by using internal property
      registry._leaveEventDispatcher = null;
      done();
    }, 100);
  });
});
