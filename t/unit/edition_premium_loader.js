'use strict';

var expect = require('chai').expect;
var fs = require('fs');
var os = require('os');
var path = require('path');

var config = require('../../lib/config');
var premiumLoader = require('../../lib/edition/premium_loader');

describe('Premium edition loader', function() {
  var originalEnv = {};
  var originalConfig = {};
  var tempDir;

  var envKeys = [
    'TIMEOFF_PREMIUM_MODULE',
    'TIMEOFF_PREMIUM_MODULE_REQUIRED',
  ];

  beforeEach(function() {
    envKeys.forEach(function(key) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    });

    originalConfig = {
      premiumModule: config.get('premium_module'),
      premiumModuleRequired: config.get('premium_module_required'),
    };
    config.set('premium_module', '');
    config.set('premium_module_required', false);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeoff-premium-loader-'));
  });

  afterEach(function() {
    envKeys.forEach(function(key) {
      if (typeof originalEnv[key] === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });

    config.set('premium_module', originalConfig.premiumModule);
    config.set('premium_module_required', originalConfig.premiumModuleRequired);
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  function writeModule(name, source) {
    var modulePath = path.join(tempDir, name);
    fs.writeFileSync(modulePath, source);
    return modulePath;
  }

  function createRegistry() {
    return {
      calls: [],
      registerRoute: function(route) {
        this.calls.push({type: 'route', route: route});
      },
      registerScheduler: function(scheduler) {
        this.calls.push({type: 'scheduler', scheduler: scheduler});
      },
    };
  }

  it('keeps community mode when no premium module is configured', function() {
    var result = premiumLoader.load({
      registry: createRegistry(),
      logger: { warn: function() {} },
    });

    expect(result.loaded).to.equal(false);
    expect(result.moduleName).to.equal(null);
  });

  it('loads premium modules that export a function', function() {
    var modulePath = writeModule('function-module.js', [
      "'use strict';",
      "module.exports = function({registry}) {",
      "  registry.registerRoute({name: 'premium', path: '/premium/', router: function() {}});",
      "};",
    ].join('\n'));
    var registry = createRegistry();

    process.env.TIMEOFF_PREMIUM_MODULE = modulePath;

    var result = premiumLoader.load({registry: registry});

    expect(result.loaded).to.equal(true);
    expect(result.required).to.equal(false);
    expect(registry.calls.length).to.equal(1);
    expect(registry.calls[0].route.name).to.equal('premium');
  });

  it('loads premium modules that export register function', function() {
    var modulePath = writeModule('object-module.js', [
      "'use strict';",
      "module.exports = {",
      "  register: function({registry}) {",
      "    registry.registerScheduler({name: 'premium-job', start: function() { return {}; }});",
      "  }",
      "};",
    ].join('\n'));
    var registry = createRegistry();

    process.env.TIMEOFF_PREMIUM_MODULE = modulePath;

    var result = premiumLoader.load({registry: registry});

    expect(result.loaded).to.equal(true);
    expect(registry.calls.length).to.equal(1);
    expect(registry.calls[0].scheduler.name).to.equal('premium-job');
  });

  it('does not throw when optional premium module is missing', function() {
    var warnings = [];

    process.env.TIMEOFF_PREMIUM_MODULE = '@missing/timeoff-premium';

    var result = premiumLoader.load({
      registry: createRegistry(),
      logger: {
        warn: function(message) {
          warnings.push(message);
        },
      },
    });

    expect(result.loaded).to.equal(false);
    expect(result.moduleName).to.equal('@missing/timeoff-premium');
    expect(warnings[0]).to.match(/Premium module not installed/);
  });

  it('throws when required premium module is missing', function() {
    process.env.TIMEOFF_PREMIUM_MODULE = '@missing/timeoff-premium';
    process.env.TIMEOFF_PREMIUM_MODULE_REQUIRED = 'true';

    expect(function() {
      premiumLoader.load({
        registry: createRegistry(),
        logger: { warn: function() {} },
      });
    }).to.throw(/Premium module required but not installed: @missing\/timeoff-premium/);
  });

  it('rethrows missing dependencies from installed premium module', function() {
    var modulePath = writeModule('nested-missing.js', [
      "'use strict';",
      "require('./missing_dependency');",
      "module.exports = function() {};",
    ].join('\n'));

    process.env.TIMEOFF_PREMIUM_MODULE = modulePath;

    expect(function() {
      premiumLoader.load({
        registry: createRegistry(),
        logger: { warn: function() {} },
      });
    }).to.throw(/missing_dependency/);
  });

  it('throws for invalid premium module export', function() {
    var modulePath = writeModule('invalid-module.js', [
      "'use strict';",
      "module.exports = {};",
    ].join('\n'));

    process.env.TIMEOFF_PREMIUM_MODULE = modulePath;

    expect(function() {
      premiumLoader.load({registry: createRegistry()});
    }).to.throw(/must export function or register/);
  });
});
