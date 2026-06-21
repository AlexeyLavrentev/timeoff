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
    };
  }

  it('does not register extracted premium implementations directly', function() {
    var registry = createRegistry();
    var result = community.register({registry: registry});

    expect(result.name).to.equal('community');
    expect(registry.routes).to.deep.equal([]);
    expect(registry.notificationProviders).to.deep.equal([]);
    expect(registry.navigationItems.map(function(item) { return item.name; }))
      .to.deep.equal(['auth-config']);
  });
});
