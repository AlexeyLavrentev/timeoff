'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'views', 'partials', 'team_view_table.hbs'),
  'utf8'
);

describe('Team View employee-summary trigger markup', function() {

  it('keeps the <td> as the sticky employee cell with the existing contracts', function() {
    expect(source).to.match(/<td class="left-column-cell cross-link"/);
    // data-user-id stays on the <td> for backwards compatibility with tests.
    expect(source).to.match(/<td[^>]*data-user-id=/);
  });

  it('removes the popover trigger class from the <td> itself', function() {
    // The <td> must no longer be a user-details-summary-trigger; only the
    // inner button is. Match the opening td tag and assert it lacks the class.
    const tdOpen = source.match(/<td class="left-column-cell cross-link"[^>]*>/);
    expect(tdOpen, 'expected the employee <td> to exist').to.not.be.null;
    expect(tdOpen[0], 'td must not carry user-details-summary-trigger').to.not.contain('user-details-summary-trigger');
  });

  it('wraps the name and button in a .team-view-employee-cell container', function() {
    expect(source).to.contain('team-view-employee-cell');
  });

  it('keeps the admin edit link as a real anchor with /users/edit/:id/', function() {
    expect(source).to.match(/<a class="team-view-employee-link" href="\/users\/edit\/\{\{this\.id\}\}\/">/);
  });

  it('renders the non-admin name as plain text, not a link', function() {
    expect(source).to.match(/<span class="team-view-employee-name">\s*\{\{\s*this\.full_name\s*\}\}\s*<\/span>/);
  });

  it('adds a real <button type="button"> as the summary trigger', function() {
    expect(source).to.match(
      /<button[^>]*type="button"[^>]*class="[^"]*\binteractive-user-details-summary-trigger\b[^"]*"/
    );
  });

  it('the summary button carries all expected marker classes', function() {
    expect(source).to.match(
      /<button[^>]*class="user-details-summary-trigger interactive-user-details-summary-trigger team-view-user-details-summary-trigger details-trigger-button"/
    );
  });

  it('keeps data-user-id on the summary button', function() {
    expect(source).to.match(
      /<button[^>]*class="[^"]*team-view-user-details-summary-trigger[^"]*"[^>]*data-user-id="\{\{this\.user\.id\}\}"/
    );
  });

  it('exposes an accessible name built from the localised label + user name', function() {
    expect(source).to.match(
      /aria-label="\{\{t 'user\.employeeSummary'\}\}: \{\{this\.user\.full_name\}\}"/
    );
  });

  it('keeps the Font Awesome icon purely decorative', function() {
    expect(source).to.match(/<span class="fa fa-question-circle" aria-hidden="true"><\/span>/);
  });

  it('does not nest the button inside the admin link', function() {
    // The button must be a sibling of the link inside the cell, not a child.
    const linkOpenIdx = source.indexOf('team-view-employee-link');
    const buttonIdx = source.indexOf('team-view-user-details-summary-trigger');
    expect(linkOpenIdx, 'expected an admin link').to.be.greaterThan(-1);
    expect(buttonIdx, 'expected a summary button').to.be.greaterThan(-1);
    // The closing </a> must appear before the button opening tag.
    const linkCloseIdx = source.indexOf('</a>', linkOpenIdx);
    expect(linkCloseIdx, 'expected admin link to close').to.be.greaterThan(-1);
    expect(linkCloseIdx, 'button must not be nested inside the admin link').to.be.lessThan(buttonIdx);
  });

  it('keeps the deducted-days and calendar-cell contracts unchanged', function() {
    expect(source).to.contain('team-view-deducted-cell');
    expect(source).to.contain('teamview-deducted-days');
    expect(source).to.contain('data-toggle="popover"');
    expect(source).to.contain('data-trigger="focus hover"');
    expect(source).to.contain('{{> team_view_calendar_cell');
  });
});
