'use strict';

const expect = require('chai').expect;
const runtimeShutdown = require('../../lib/runtime_shutdown');
const spawnSync = require('child_process').spawnSync;

describe('Runtime shutdown coordinator', function() {
  it('executes cleanup and exit only once', async function() {
    var closes = 0;
    var exits = [];
    var shutdown = runtimeShutdown.createShutdownCoordinator({
      server: {close: callback => { closes += 1; callback(); }},
      db: {close: () => { closes += 1; }},
      exit: code => exits.push(code),
      timeoutMs: 20,
    });

    var results = await Promise.all([
      shutdown('fatal_test', new Error('boom'), 1),
      shutdown('fatal_test_again', new Error('boom'), 1),
    ]);

    expect(closes).to.equal(2);
    expect(exits).to.deep.equal([1]);
    expect(results).to.deep.equal([true, false]);
  });

  it('does not install fatal listeners by importing app.js source', function() {
    var source = require('fs').readFileSync(require('path').join(__dirname, '../../app.js'), 'utf8');
    expect(source).to.not.contain("process.on('uncaughtException'");
    expect(source).to.not.contain("process.on('unhandledRejection'");
  });

  ['uncaughtException', 'unhandledRejection'].forEach(function(kind) {
    it('logs ' + kind + ' once and exits non-zero', function() {
      var script = [
        "const r=require('./lib/runtime_shutdown')",
        "r.installProcessHandlers({timeoutMs:20,exit:code=>process.exit(code)})",
        kind === 'uncaughtException'
          ? "setImmediate(()=>{throw new Error('fatal-fixture')})"
          : "Promise.reject(new Error('fatal-fixture'))",
      ].join(';');
      var result = spawnSync(process.execPath, ['-e', script], {
        cwd: require('path').join(__dirname, '../..'),
        encoding: 'utf8',
      });
      var lines = result.stderr.split('\n').filter(line => line.includes(kind === 'uncaughtException' ? 'uncaught_exception' : 'unhandled_rejection'));
      expect(result.status).to.equal(1);
      expect(lines).to.have.length(1);
      expect(lines[0]).to.contain('fatal-fixture');
    });
  });
});
