'use strict';

var expect = require('chai').expect;
var EditionRegistry = require('../../lib/edition/registry');

describe('Edition registry', function() {
  var originalFeatureTimeBalance;

  beforeEach(function() {
    originalFeatureTimeBalance = process.env.FEATURE_TIME_BALANCE;
    delete process.env.FEATURE_TIME_BALANCE;
  });

  afterEach(function() {
    if (typeof originalFeatureTimeBalance === 'undefined') {
      delete process.env.FEATURE_TIME_BALANCE;
    } else {
      process.env.FEATURE_TIME_BALANCE = originalFeatureTimeBalance;
    }
  });

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

  it('returns copies of registered route and scheduler contracts', function() {
    var registry = new EditionRegistry();
    var router = function() {};

    registry.registerRoute({
      name   : 'premium-page',
      path   : '/premium/',
      router : router,
    });
    registry.registerScheduler({
      name  : 'premium-scheduler',
      start : function() {},
    });

    var routes = registry.getRoutes();
    var schedulers = registry.getSchedulers();

    routes[0].name = 'mutated-route';
    schedulers[0].name = 'mutated-scheduler';

    expect(registry.getRoutes()[0].name).to.equal('premium-page');
    expect(registry.getSchedulers()[0].name).to.equal('premium-scheduler');
  });

  it('validates and filters navigation items by feature', function() {
    var registry = new EditionRegistry();

    expect(function() {
      registry.registerNavigationItem({name: 'broken'});
    }).to.throw(/navigation item requires/);

    registry.registerNavigationItem({
      feature  : 'time_balance',
      name     : 'time-balance',
      path     : '/time-balance/',
      labelKey : 'nav.timeBalance',
      location : 'primary',
      order    : 20,
    });
    registry.registerNavigationItem({
      feature  : 'integration_api',
      name     : 'integration-api',
      path     : '/settings/company/integration-api/',
      labelKey : 'nav.apiConfig',
      location : 'settings',
      order    : 10,
    });

    expect(registry.getNavigationItems().length).to.equal(0);

    process.env.FEATURE_TIME_BALANCE = 'true';

    var enabledItems = registry.getNavigationItems();

    expect(enabledItems.length).to.equal(1);
    expect(enabledItems[0].name).to.equal('time-balance');

    enabledItems[0].name = 'mutated';

    expect(registry.getNavigationItems()[0].name).to.equal('time-balance');
    expect(registry.getNavigationItems({location: 'settings', enabledOnly: false})[0].name)
      .to.equal('integration-api');
  });

  it('validates and filters notification providers without executing disabled providers', function() {
    var registry = new EditionRegistry();
    var fetchCalls = 0;
    var fetch = function() {
      fetchCalls += 1;
      return Promise.resolve([]);
    };

    expect(function() {
      registry.registerNotificationProvider({type: 'broken'});
    }).to.throw(/notification provider requires/);

    registry.registerNotificationProvider({
      feature : 'time_balance',
      type    : 'pending_time_balance_request',
      fetch   : fetch,
    });

    expect(registry.getNotificationProviders().length).to.equal(0);
    expect(fetchCalls).to.equal(0);

    process.env.FEATURE_TIME_BALANCE = 'true';

    var providers = registry.getNotificationProviders();
    providers[0].type = 'mutated';

    expect(providers.length).to.equal(1);
    expect(registry.getNotificationProviders()[0].type).to.equal('pending_time_balance_request');
  });

  it('collects safe diagnostic entries', async function() {
    var registry = new EditionRegistry();

    expect(function() {
      registry.registerDiagnostic({name: 'broken'});
    }).to.throw(/diagnostic requires/);

    registry.registerDiagnostic({
      name: 'license',
      collect: function(context) {
        return {
          status: context.status,
          secret: undefined,
        };
      },
    });

    var diagnostics = await registry.collectDiagnostics({status: 'valid'});

    expect(diagnostics).to.deep.equal([{
      name: 'license',
      status: 'valid',
      secret: undefined,
    }]);

    var registered = registry.getDiagnostics();
    registered[0].name = 'mutated';

    expect(registry.getDiagnostics()[0].name).to.equal('license');
  });

  it('registers unique view paths and applies them to express app', function() {
    var registry = new EditionRegistry();
    var appViews;

    registry.registerViewPath('/premium/views');
    registry.registerViewPath('/premium/views');

    expect(function() {
      registry.registerViewPath({});
    }).to.throw(/view path requires/);

    var applied = registry.applyViewPaths({
      set: function(key, value) {
        if (key === 'views') {
          appViews = value;
        }
      },
    }, ['/core/views', '/premium/views']);

    expect(registry.getViewPaths()).to.deep.equal(['/premium/views']);
    expect(applied).to.deep.equal(['/core/views', '/premium/views']);
    expect(appViews).to.deep.equal(['/core/views', '/premium/views']);
  });
});
