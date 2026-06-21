'use strict';

var expect = require('chai').expect;
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

describe('Edition initialization', function() {
  it('rolls back partial registry state after a failed premium load', function() {
    var repoRoot = path.join(__dirname, '..', '..');
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeoff-edition-init-'));
    var modulePath = path.join(tempDir, 'premium.js');
    var script = [
      "const fs=require('fs');",
      "const edition=require('./lib/edition');",
      "const modulePath=process.env.TEST_PREMIUM_MODULE;",
      "fs.writeFileSync(modulePath,\"module.exports={register:({registry})=>{registry.registerRoute({name:'partial',path:'/partial/',router:function(){}});throw new Error('expected failure')}};\");",
      "process.env.TIMEOFF_PREMIUM_MODULE=modulePath;",
      "try{edition.initialize({});}catch(error){}",
      "fs.writeFileSync(modulePath,\"module.exports={register:({registry})=>{registry.registerRoute({name:'premium',path:'/premium/',router:function(){}})}};\");",
      "delete require.cache[require.resolve(modulePath)];",
      "edition.initialize({});",
      "console.log(JSON.stringify({routes:edition.getRegistry().getRoutes().map(route=>route.name),navigation:edition.getRegistry().getNavigationItems({enabledOnly:false}).map(item=>item.name)}));",
    ].join('');

    try {
      var output = childProcess.execFileSync(process.execPath, ['-e', script], {
        cwd: repoRoot,
        env: Object.assign({}, process.env, {
          NODE_ENV: 'test',
          TEST_PREMIUM_MODULE: modulePath,
        }),
        encoding: 'utf8',
      }).trim();
      var result = JSON.parse(output);

      expect(result.routes).to.deep.equal(['premium']);
      expect(result.navigation).to.deep.equal(['auth-config']);
    } finally {
      fs.rmSync(tempDir, {recursive: true, force: true});
    }
  });
});
