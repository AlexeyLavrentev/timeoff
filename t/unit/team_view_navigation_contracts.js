'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

function readView(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'views', relativePath), 'utf8');
}

describe('Team View horizontal navigation contracts', function() {

  describe('table shell and scroll cue (team_view_table.hbs)', function() {
    const source = readView(path.join('partials', 'team_view_table.hbs'));

    it('preserves the scrollable .team-view-table-container region', function() {
      expect(source).to.contain('team-view-table-container');
      expect(source).to.match(/role="region"/);
      expect(source).to.match(/tabindex="0"/);
      expect(source).to.match(/aria-label="\{\{department\.departmentName\}\}"/);
    });

    it('wraps the container in a .team-view-table-shell', function() {
      // The shell must appear before the container in source order.
      const shellIdx = source.indexOf('team-view-table-shell');
      const containerIdx = source.indexOf('team-view-table-container');
      expect(shellIdx, 'expected a team-view-table-shell wrapper').to.be.greaterThan(-1);
      expect(shellIdx, 'shell should open before the container').to.be.lessThan(containerIdx);
    });

    it('adds a decorative scroll cue with aria-hidden', function() {
      expect(source).to.contain('team-view-scroll-cue');
      // The cue must be hidden from assistive tech.
      const cueIdx = source.indexOf('team-view-scroll-cue');
      const cueBlock = source.slice(cueIdx, cueIdx + 120);
      expect(cueBlock).to.contain('aria-hidden="true"');
    });

    it('uses a Font Awesome chevron inside the cue', function() {
      expect(source).to.match(/team-view-scroll-cue[\s\S]*fa-chevron-right/);
    });

    it('keeps the existing row, cell and data contracts intact', function() {
      expect(source).to.contain('teamview-user-list-row');
      expect(source).to.contain('data-vpp-user-list-row');
      // The <td> keeps the sticky-cell contract classes; the popover trigger
      // class now lives on the dedicated button inside the cell (Stage 5).
      expect(source).to.contain('left-column-cell cross-link');
      expect(source).to.contain('data-user-id');
      expect(source).to.contain('team-view-deducted-cell');
      expect(source).to.contain('teamview-deducted-days');
      expect(source).to.contain('data-toggle="popover"');
      expect(source).to.contain('data-trigger="focus hover"');
      // Calendar cells are still rendered via the shared partial.
      expect(source).to.contain('{{> team_view_calendar_cell');
    });
  });

  describe('mobile period navigation (team_view.hbs)', function() {
    const source = readView('team_view.hbs');

    it('adds accessible names with full month/year to both previous/next links', function() {
      // Previous link
      expect(source).to.match(
        /team-view-period-link[\s\S]*?base_date\s*=\s*prev_date[\s\S]*?aria-label="\{\{as_date_formatted prev_date 'MMMM, YYYY' \}\}"/
      );
      // Next link
      expect(source).to.match(
        /team-view-period-link[\s\S]*?base_date\s*=\s*next_date[\s\S]*?aria-label="\{\{as_date_formatted next_date 'MMMM, YYYY' \}\}"/
      );
    });

    it('wraps the visible abbreviated month text in .team-view-period-link-label', function() {
      expect(source).to.match(
        /team-view-period-link-label[^>]*>\{\{as_date_formatted prev_date 'MMM' \}\}/
      );
      expect(source).to.match(
        /team-view-period-link-label[^>]*>\{\{as_date_formatted next_date 'MMM'\}\}/
      );
    });

    it('preserves the team_view_url_parameters partial and base_date for navigation', function() {
      expect(source).to.contain('{{> team_view_url_parameters base_date = prev_date }}');
      expect(source).to.contain('{{> team_view_url_parameters base_date = next_date }}');
    });
  });
});
