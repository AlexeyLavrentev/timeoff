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
  });

  templates.forEach(template => {
    it(`keeps leave details available on calendar weekends in ${template.fileName}`, function() {
      const html = template.render({
        day: {
          val                 : 7,
          is_calendar_weekend : true,
          is_weekend          : true,
          is_leave_morning    : true,
          leave_obj           : { id: 42 },
        },
      });

      expect(html).to.contain('leave-details-summary-trigger');
      expect(html).to.contain('data-leave-id="42"');
      if (template.fileName === 'calendar_cell.hbs') {
        expect(html).to.contain('data-original-title=');
      }
    });

    it(`keeps leave details available on bank holidays in ${template.fileName}`, function() {
      const html = template.render({
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
    });
  });
});
