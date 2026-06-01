'use strict';

var expect = require('chai').expect,
  timeBalance = require('../../../lib/model/time_balance');

describe('Time balance approval policy', function(){
  const entryFor = function(userId, bossId) {
    return {
      userId : userId,
      user : { department : { bossId : bossId } },
      is_new : function(){ return true; },
    };
  };

  it('allows the employee department boss to process a request', function(){
    expect(timeBalance.canActOnEntry({
      entry : entryFor(11, 7),
      actingUser : { id : 7, is_admin : function(){ return false; } },
    })).to.equal(true);
  });

  it('does not allow another supervisor to process a request', function(){
    expect(timeBalance.canActOnEntry({
      entry : entryFor(11, 7),
      actingUser : { id : 8, is_admin : function(){ return false; } },
    })).to.equal(false);
  });

  it('allows an administrator to process another employee request', function(){
    expect(timeBalance.canActOnEntry({
      entry : entryFor(11, 7),
      actingUser : { id : 1, is_admin : function(){ return true; } },
    })).to.equal(true);
  });

  it('does not allow an employee to process their own request', function(){
    expect(timeBalance.canActOnEntry({
      entry : entryFor(11, 11),
      actingUser : { id : 11, is_admin : function(){ return true; } },
    })).to.equal(false);
  });
});
