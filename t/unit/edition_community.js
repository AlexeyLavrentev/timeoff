'use strict';

var expect = require('chai').expect;
var community = require('../../lib/edition/community');

describe('Community edition module', function() {
  function createRegistry() {
    return {
      routes: [],
      navigationItems: [],
      notificationProviders: [],
      registerRoute: function(route) {
        this.routes.push(route);
      },
      registerNavigationItem: function(item) {
        this.navigationItems.push(item);
      },
      registerNotificationProvider: function(provider) {
        this.notificationProviders.push(provider);
      },
      registerSsoProvider: function() {},
      registerScheduler: function(scheduler) {
        this.schedulers.push(scheduler);
      },
      schedulers: [],
    };
  }

  it('registers only community implementations', function() {
    var registry = createRegistry();
    var result = community.register({registry: registry});

    expect(result.name).to.equal('community');
    expect(registry.routes.map(function(route) { return route.name; }))
      .to.deep.equal(['reminder-schedules-settings', 'reminder-schedules-api']);
    expect(registry.schedulers.map(function(scheduler) { return scheduler.name; }))
      .to.deep.equal(['leave-start-reminders']);
    expect(registry.notificationProviders).to.deep.equal([]);
    expect(registry.navigationItems.map(function(item) { return item.name; }))
      .to.deep.equal(['auth-config', 'reminder-schedules']);
  });
});
