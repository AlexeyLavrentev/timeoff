'use strict';

var expect = require('chai').expect,
  model = require('../../../../lib/model/db');

describe('TimeBalanceEntry', function(){
  it('treats paid time off as negative hours', function(){
    var entry = model.TimeBalanceEntry.build({
      entry_type : model.TimeBalanceEntry.entry_type_time_off(),
      hours : 4,
      status : model.TimeBalanceEntry.status_approved(),
      date : '2026-05-01',
    });

    expect(entry.signed_hours()).to.be.equal(-4);
  });

  it('treats extra worked time as positive hours', function(){
    var entry = model.TimeBalanceEntry.build({
      entry_type : model.TimeBalanceEntry.entry_type_worked_extra(),
      hours : 3.5,
      status : model.TimeBalanceEntry.status_approved(),
      date : '2026-05-02',
    });

    expect(entry.signed_hours()).to.be.equal(3.5);
  });

  it('knows pending and approved statuses', function(){
    var entry = model.TimeBalanceEntry.build({
      entry_type : model.TimeBalanceEntry.entry_type_time_off(),
      hours : 1,
      status : model.TimeBalanceEntry.status_new(),
      date : '2026-05-03',
    });

    expect(entry.is_new()).to.be.equal(true);
    expect(entry.is_approved()).to.be.equal(false);

    entry.status = model.TimeBalanceEntry.status_approved();

    expect(entry.is_new()).to.be.equal(false);
    expect(entry.is_approved()).to.be.equal(true);
  });
});
