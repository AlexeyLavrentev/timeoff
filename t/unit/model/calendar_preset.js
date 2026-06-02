'use strict';

var expect = require('chai').expect,
  calendarPreset = require('../../../lib/model/calendar_preset');

describe('Official calendar preset', function(){
  it('previews missing KZ calendar days for the selected year', function(){
    const preview = calendarPreset.buildPreview({
      country : 'KZ',
      year : 2026,
      bankHolidays : [],
    });

    expect(preview.length).to.be.above(0);
    expect(preview.every(day => day.action === 'add')).to.equal(true);
  });

  it('keeps a manual company day instead of overwriting it', function(){
    const preview = calendarPreset.buildPreview({
      country : 'KZ',
      year : 2026,
      bankHolidays : [{
        id : 19,
        name : 'Manual name',
        date : '2026-01-01',
        day_type : 'working',
      }],
    });
    const newYear = preview.find(day => day.date === '2026-01-01');

    expect(newYear.action).to.equal('keep');
    expect(newYear.id).to.equal(19);
  });

  it('updates an earlier imported record when the bundled preset changes', function(){
    const preview = calendarPreset.buildPreview({
      country : 'RU',
      year : 2026,
      bankHolidays : [{
        id : 23,
        name : 'Old imported name',
        date : '2026-01-01',
        day_type : 'non_working',
        import_source : calendarPreset.IMPORT_SOURCE,
      }],
    });
    const newYear = preview.find(day => day.date === '2026-01-01');

    expect(newYear.action).to.equal('update');
    expect(newYear.id).to.equal(23);
  });

  it('uses different transferred days for five-day and six-day KZ calendars', function(){
    const fiveDay = calendarPreset.getPresetDays({
      country : 'KZ',
      year : 2026,
      weekType : calendarPreset.WEEK_TYPE_FIVE_DAY,
    });
    const sixDay = calendarPreset.getPresetDays({
      country : 'KZ',
      year : 2026,
      weekType : calendarPreset.WEEK_TYPE_SIX_DAY,
    });

    expect(fiveDay.some(day => day.date === '2026-03-25')).to.equal(true);
    expect(sixDay.some(day => day.date === '2026-03-25')).to.equal(false);
  });
});
