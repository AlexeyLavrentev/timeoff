'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const Handlebars = require('handlebars');
const path = require('path');

describe('Calendar cell view', function() {
  const templates = [
    'calendar_cell.hbs',
    'team_view_calendar_cell.hbs',
  ].map(fileName => ({
    fileName,
    render: Handlebars.compile(
      fs.readFileSync(path.join(__dirname, '../../views/partials', fileName), 'utf8')
    ),
  }));

  before(function() {
    Handlebars.registerHelper('t', key => key);
    Handlebars.registerHelper('as_date_formatted', () => '7 July 2026');
  });

  templates.forEach(template => {
    it(`keeps leave details available on calendar weekends in ${template.fileName}`, function() {
      const html = template.render({
        employee: { full_name: 'Ada Lovelace' },
        day: {
          val                 : 7,
          is_calendar_weekend : true,
          is_weekend          : true,
          is_leave_morning    : true,
          leave_obj           : { id: 42 },
        },
      });

      expect(html).to.contain('leave-details-summary-trigger');
      expect(html).to.contain('interactive-leave-details-summary-trigger');
      expect(html).to.match(/<button\s+type="button"/);
      expect(html).to.contain('data-leave-id="42"');
      expect(html).to.contain('aria-expanded="false"');
      expect(html).to.match(/aria-label="[^"]+"/);
      expect(html).not.to.contain('data-toggle="tooltip"');
      expect(html).not.to.contain('data-toggle="popover"');
      if (template.fileName === 'calendar_cell.hbs') {
        expect(html).to.contain('data-original-title=');
      } else {
        expect(html).to.contain('team-view-leave-details-trigger');
        expect(html).to.contain('Ada Lovelace, 7 July 2026');
      }
    });

    it(`keeps leave details available on bank holidays in ${template.fileName}`, function() {
      const html = template.render({
        employee: { full_name: 'Ada Lovelace' },
        day: {
          val                : 8,
          is_bank_holiday    : true,
          bank_holiday_name  : 'Holiday',
          is_leave_morning   : true,
          leave_obj          : { id: 84 },
        },
      });

      expect(html).to.contain('leave-details-summary-trigger');
      expect(html).to.contain('data-leave-id="84"');
      expect(html).not.to.contain('data-toggle="tooltip"');
      expect(html).not.to.contain('data-toggle="popover"');
    });

    it(`does not create a leave trigger without an absence in ${template.fileName}`, function() {
      const html = template.render({
        day: {
          val                 : 9,
          is_calendar_weekend : true,
          is_weekend          : true,
        },
      });

      expect(html).not.to.contain('leave-details-summary-trigger');
      expect(html).not.to.contain('data-leave-id=');
      expect(html).to.match(/<span[^>]*>9<\/span>/);
      expect(html).not.to.contain('<button');
    });

    it(`preserves current-day and half-cell contracts in ${template.fileName}`, function() {
      const html = template.render({
        day: {
          val                : 10,
          is_current_day     : true,
          is_bank_holiday    : true,
          bank_holiday_name  : 'Holiday',
          is_leave_morning   : true,
          is_leave_afternoon : true,
          is_new_leave       : true,
        },
      });

      expect(html).to.contain('half_1st');
      expect(html).to.contain('half_2nd');
      expect(html).to.contain('current_day_cell');
      expect(html).to.contain('leave_cell_pended');
      expect(html).to.contain('data-toggle="tooltip"');
      expect(html).to.contain('calendar.tooltip.bankHoliday');
    });
  });
});
