'use strict';

var expect = require('chai').expect;
var path = require('path');
var bundledPremium = require('../../lib/edition/bundled_premium');
var features = require('../../lib/features');

describe('Bundled premium edition module', function() {
  function createRegistry() {
    return {
      routes: [],
      navigationItems: [],
      notificationProviders: [],
      viewPaths: [],
      emailTemplatePaths: [],
      partialTemplatePaths: [],
      dbModelPaths: [],
      localePaths: [],
      dbAssociations: [],
      registerViewPath: function(viewPath) {
        this.viewPaths.push(viewPath);
      },
      registerEmailTemplatePath: function(emailTemplatePath) {
        this.emailTemplatePaths.push(emailTemplatePath);
      },
      registerPartialTemplatePath: function(partialTemplatePath) {
        this.partialTemplatePaths.push(partialTemplatePath);
      },
      registerDbModelPath: function(dbModelPath) {
        this.dbModelPaths.push(dbModelPath);
      },
      registerLocalePath: function(localePath) {
        this.localePaths.push(localePath);
      },
      registerDbAssociation: function(dbAssociation) {
        this.dbAssociations.push(dbAssociation);
      },
      registerRoute: function(route) {
        this.routes.push(route);
      },
      registerNavigationItem: function(item) {
        this.navigationItems.push(item);
      },
      registerNotificationProvider: function(provider) {
        this.notificationProviders.push(provider);
      },
    };
  }

  it('registers extracted premium capabilities through the module contract', function() {
    var registry = createRegistry();
    var result = bundledPremium.register({registry: registry});

    expect(result.name).to.equal('bundled-premium');
    expect(features.catalog.time_balance).to.deep.equal({defaultEnabled: false});
    expect(features.catalog.vacation_planning).to.deep.equal({defaultEnabled: false});
    expect(registry.routes.map(function(route) { return route.name; }))
      .to.deep.equal(['time-balance', 'vacation-plans']);
    expect(registry.navigationItems.map(function(item) { return item.name; }))
      .to.deep.equal(['time-balance', 'vacation-plans']);
    expect(registry.notificationProviders.map(function(provider) { return provider.type; }))
      .to.deep.equal(['pending_time_balance_request', 'pending_vacation_plan']);
    expect(registry.notificationProviders[0].badgeId).to.equal('time-balance-nav-badge');
    expect(registry.viewPaths.length).to.equal(1);
    expect(registry.viewPaths[0]).to.equal(
      path.join(__dirname, '..', '..', 'lib', 'edition', 'bundled_premium', 'views')
    );
    expect(registry.emailTemplatePaths.length).to.equal(1);
    expect(registry.partialTemplatePaths.length).to.equal(1);
    expect(registry.dbModelPaths.length).to.equal(1);
    expect(registry.localePaths.length).to.equal(1);
    expect(registry.dbAssociations.map(function(dbAssociation) { return dbAssociation.name; }))
      .to.deep.equal(['time-balance-company-user', 'vacation-plans-company-user']);
  });
});
