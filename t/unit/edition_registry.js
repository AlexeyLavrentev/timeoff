'use strict';

var expect = require('chai').expect;
var EditionRegistry = require('../../lib/edition/registry');

describe('Edition registry', function() {
  it('applies registered routes to express app', function() {
    var registry = new EditionRegistry();
    var calls = [];
    var middleware = function(req, res, next) { next(); };
    var router = function(req, res) { res.end(); };

    registry.registerRoute({
      name       : 'premium-page',
      path       : '/premium/',
      middleware : [middleware],
      router     : router,
    });

    registry.applyRoutes({
      use: function() {
        calls.push(Array.prototype.slice.call(arguments));
      },
    });

    expect(calls.length).to.equal(1);
    expect(calls[0][0]).to.equal('/premium/');
    expect(calls[0][1]).to.equal(middleware);
    expect(calls[0][2]).to.equal(router);
  });

  it('starts registered schedulers', function() {
    var registry = new EditionRegistry();
    var startedWith;

    registry.registerScheduler({
      name: 'premium-scheduler',
      start: function(context) {
        startedWith = context;
        return { stop: function() {} };
      },
    });

    var handles = registry.startSchedulers({
      models: { connected: true },
    });

    expect(startedWith.models.connected).to.equal(true);
    expect(handles.length).to.equal(1);
    expect(handles[0].name).to.equal('premium-scheduler');
    expect(handles[0].handle.stop).to.be.a('function');
  });

  it('rejects incomplete extension contracts', function() {
    var registry = new EditionRegistry();

    expect(function() {
      registry.registerRoute({ path: '/broken/' });
    }).to.throw(/path and router/);

    expect(function() {
      registry.registerScheduler({ name: 'broken' });
    }).to.throw(/name and start/);
  });
});
