'use strict';

var expect = require('chai').expect;
var childProcess = require('child_process');
var path = require('path');

describe('Edition community boundary', function() {
  function runNode(script, env) {
    return childProcess.execFileSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..', '..'),
      env: Object.assign({}, process.env, env || {}),
      encoding: 'utf8',
    }).trim();
  }

  it('does not load bundled premium DB models in community mode', function() {
    var output = runNode([
      "delete process.env.TIMEOFF_PREMIUM_MODULE;",
      "const app=require('./app');",
      "const db=app.get('db_model');",
      "console.log(Boolean(db.TimeBalanceEntry) + ',' + Boolean(db.VacationPlan));",
      "process.exit(0);",
    ].join(''));

    expect(output).to.equal('false,false');
  });

  it('loads bundled premium DB models when premium module is configured', function() {
    var output = runNode([
      "const app=require('./app');",
      "const db=app.get('db_model');",
      "const edition=require('./lib/edition');",
      "console.log(Boolean(db.TimeBalanceEntry) + ',' + Boolean(db.VacationPlan) + ',' + edition.getInfo().routes.length);",
      "process.exit(0);",
    ].join(''), {
      TIMEOFF_PREMIUM_MODULE: './lib/edition/bundled_premium',
      FEATURE_TIME_BALANCE: 'true',
      FEATURE_VACATION_PLANNING: 'true',
    });

    expect(output).to.equal('true,true,2');
  });
});
