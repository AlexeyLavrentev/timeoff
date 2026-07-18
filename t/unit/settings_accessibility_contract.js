'use strict';

const fs = require('fs');
const path = require('path');
const {expect} = require('chai');

const readView = relativePath => fs.readFileSync(
  path.join(__dirname, '..', '..', 'views', relativePath),
  'utf8'
);

describe('Settings accessibility and routing contracts', function() {
  it('gives every leave-type editor control a contextual accessible name', function() {
    const view = readView('general_settings.hbs');

    expect(view).to.match(/<input type="radio"[^>]*aria-label="{{t "generalSettings\.leaveTypeNameHelp"}}: {{name}}"/);
    expect(view).to.match(/<input type="text"[^>]*name="name__{{ this\.id }}"[^>]*aria-label="{{t "generalSettings\.leaveTypeNameLabel"}}: {{name}}"/);
    expect(view).to.match(/<input type="number"[^>]*name="limit__{{ this\.id }}"[^>]*aria-label="{{t "generalSettings\.leaveTypeLimitLabel"}}: {{name}}"/);
    expect(view).to.match(/<select[^>]*name="deduction_unit__{{ this\.id }}"[^>]*aria-label="{{t "generalSettings\.leaveTypeDeductionUnitLabel"}}: {{name}}"/);
    expect(view).to.match(/<input type="number"[^>]*name="minimum_consecutive_days__{{ this\.id }}"[^>]*aria-label="{{t "generalSettings\.leaveTypeMinConsecutiveLabel"}}: {{name}}"/);
  });

  it('names department help buttons and the icon-only edit link', function() {
    const view = readView('departments_overview.hbs');

    expect(view).to.include('aria-label="{{t "departments.publicHolidays"}}"');
    expect(view).to.include('aria-label="{{t "departments.accruedAllowance"}}"');
    expect(view).to.match(/<a href="\/settings\/departments\/edit\/{{this\.id}}\/" class="btn btn-link btn-xs pull-right" aria-label="{{t "departments\.allDepartments"}}: {{this\.name}}">/);
  });

  it('posts company deletion to the registered settings route', function() {
    const view = readView(path.join('partials', 'remove_company_modal.hbs'));

    expect(view).to.include('action="/settings/company/delete/"');
    expect(view).not.to.include('/settings//company/delete/');
  });
});
