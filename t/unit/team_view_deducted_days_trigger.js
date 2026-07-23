'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const Handlebars = require('handlebars');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const templateSource = fs.readFileSync(
  path.join(root, 'views', 'partials', 'team_view_table.hbs'),
  'utf8'
);

function renderRows(rows) {
  const handlebars = Handlebars.create();

  handlebars.registerHelper('t', function(key, options) {
    if (key === 'user.employeeSummary') {
      return 'Employee summary';
    }
    expect(key).to.equal('teamView.deductedDays');
    return `In ${options.hash.period} ${options.hash.name} used ${options.hash.days} days from allowance`;
  });
  handlebars.registerHelper('full_name', user => user.full_name);
  handlebars.registerPartial('team_view_calendar_cell', '');

  return handlebars.compile(templateSource)({
    deducted_period: 'July 2026',
    logged_user: {admin: false},
    department: {
      departmentName: 'Engineering',
      header_days: [],
      users_and_leaves: rows,
    },
  });
}

function row(options) {
  return {
    user: {
      id: options.id,
      full_name: options.name,
    },
    statistics: options.statistics,
    days: [],
  };
}

function deductedCell(html) {
  const match = html.match(/<td class="team-view-deducted-cell">([\s\S]*?)<\/td>/);
  expect(match, 'expected deducted-days cell').to.not.be.null;
  return match[1];
}

describe('Interactive Team View deducted-days trigger contract', function() {
  describe('authorized markup', function() {
    [0, 1.5].forEach(days => {
      it(`renders exact ${days} content through the explicit employeeRow scope`, function() {
        const cell = deductedCell(renderRows([
          row({
            id: 7,
            name: 'Alex Example',
            statistics: {deducted_days: days},
          }),
        ]));
        const expected = `In July 2026 Alex Example used ${days} days from allowance`;

        expect(cell).to.match(/<button\s+type="button"/);
        expect(cell).to.contain(
          'class="teamview-deducted-days interactive-teamview-deducted-days-trigger team-view-deducted-days-trigger"'
        );
        expect(cell).to.contain(`data-content="${expected}"`);
        expect(cell).to.contain(`aria-label="${expected}"`);
        expect(cell).to.contain('aria-expanded="false"');
        expect(cell).to.contain(`<span aria-hidden="true">${days}</span>`);
      });
    });

    it('uses explicit row aliases and avoids generic Bootstrap trigger attributes', function() {
      expect(templateSource).to.contain('name=(full_name employeeRow.user)');
      expect(templateSource).to.contain('days=employeeRow.statistics.deducted_days');
      expect(templateSource).not.to.contain('days=../statistics.deducted_days');

      const cell = deductedCell(renderRows([
        row({
          id: 8,
          name: 'Taylor Example',
          statistics: {deducted_days: 2},
        }),
      ]));
      [
        'data-toggle',
        'data-trigger',
        'data-placement',
        'tabindex',
        'role="button"',
        'href=',
        'class="btn',
      ].forEach(fragment => expect(cell).not.to.contain(fragment));
    });
  });

  describe('unauthorized markup', function() {
    it('leaves the deducted cell empty and exposes no trigger metadata', function() {
      const cell = deductedCell(renderRows([
        row({
          id: 9,
          name: 'Private Example',
          statistics: undefined,
        }),
      ]));

      expect(cell.trim()).to.equal('');
      expect(cell).not.to.contain('interactive-teamview-deducted-days-trigger');
      expect(cell).not.to.contain('data-content');
      expect(cell).not.to.contain('aria-label');
      expect(cell).not.to.contain('Private Example');
      expect(cell).not.to.contain('<button');
    });
  });

  describe('scoped styles', function() {
    const scss = fs.readFileSync(path.join(root, 'scss', 'main.scss'), 'utf8');

    it('resets native button chrome with semantic inherited colors and a 24px target', function() {
      const block = scss.match(/\.team-view-deducted-days-trigger\s*\{[^}]*\}/);
      expect(block, 'expected deducted-days button reset').to.not.be.null;
      expect(block[0]).to.match(/min-width:\s*24px/);
      expect(block[0]).to.match(/min-height:\s*24px/);
      expect(block[0]).to.match(/background:\s*transparent/);
      expect(block[0]).to.match(/border:\s*0/);
      expect(block[0]).to.match(/color:\s*inherit/);
      expect(block[0]).not.to.match(/#[0-9a-f]{3,8}/i);
    });

    it('keeps the focus ring inside the sticky deducted cell', function() {
      expect(scss).to.match(
        /\.team-view-deducted-days-trigger:focus-visible\s*\{[^}]*outline-offset:\s*1px/s
      );
    });

    it('keeps generated CSS synchronized with the scoped source selector', function() {
      const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');
      expect(css).to.contain('.team-view-deducted-days-trigger');
      expect(css).to.match(/\.team-view-deducted-days-trigger\s*\{[^}]*min-width:\s*24px/s);
    });
  });

  describe('manual controller source contract', function() {
    let controller;

    before(function() {
      const source = fs.readFileSync(path.join(root, 'public', 'js', 'global.js'), 'utf8');
      const start = source.indexOf('(function initInteractiveDeductedDaysPopovers()');
      const end = source.indexOf("var $interactiveLeaveTriggers = $('.interactive-leave-details-summary-trigger')", start);

      expect(start, 'expected isolated deducted-days controller').to.be.greaterThan(-1);
      expect(end, 'expected controller to end before leave-details state').to.be.greaterThan(start);
      controller = source.slice(start, end);
    });

    it('initializes only the dedicated marker with static manual Bootstrap options', function() {
      expect(controller).to.contain("$('.interactive-teamview-deducted-days-trigger')");
      expect(controller).not.to.contain("$('.teamview-deducted-days')");
      expect(controller).not.to.contain("$('[data-toggle=\"popover\"]')");
      expect(controller).to.contain("container: 'body'");
      expect(controller).to.contain('html: false');
      expect(controller).to.contain("trigger: 'manual'");
      expect(controller).to.contain('placement: sidePopoverPlacement');
      expect(controller).to.contain("viewport: { selector: 'body', padding: 12 }");
      expect(controller).to.contain("return $trigger.attr('data-content') || ''");
      expect(controller).not.to.match(/\btitle\s*:/);
    });

    it('keeps dedicated static state, delays, and a hoverable tip', function() {
      [
        'hovered', 'focused', 'pointerPinned', 'popoverHovered',
        'showTimer', 'hideTimer',
      ].forEach(field => expect(controller).to.contain(field + ':'));
      expect(controller).to.contain("data('deductedDaysPopoverState'");
      expect(controller).to.contain('SHOW_DELAY_HOVER = 700');
      expect(controller).to.contain('HIDE_DELAY = 120');
      expect(controller).to.contain('mouseenter.deductedDaysPopover');
      expect(controller).to.contain('mouseleave.deductedDaysPopover');
      expect(controller).not.to.match(/\bajax\b/i);
      expect(controller).not.to.match(/\bxhr\b/i);
      expect(controller).not.to.contain('aria-live');
    });

    it('binds one namespaced Escape and outside-click document handler', function() {
      expect((controller.match(/keydown\.deductedDaysPopover/g) || [])).to.have.length(1);
      // One document outside-click binding plus one per-trigger click binding.
      expect((controller.match(/click\.deductedDaysPopover/g) || [])).to.have.length(2);
      expect(controller).to.contain('$(document).off(ESCAPE_NS).on(ESCAPE_NS');
      expect(controller).to.contain('$(document).off(CLICK_NS).on(CLICK_NS');
      expect(controller).to.contain('if (!state || !state.pointerPinned) { return; }');
      expect(controller).to.contain('insidePopover');
    });

    it('provides deducted-only single-open and stale-timer cancellation', function() {
      expect(controller).to.contain('hideOtherTriggers($trigger)');
      expect(controller).to.contain('cancelShow(state)');
      expect(controller).to.contain('cancelHide(state)');
      expect(controller).to.contain('hideTrigger($other)');
      expect(controller).not.to.contain('leaveSummaryState');
      expect(controller).not.to.contain('userSummaryState');
    });

    it('uses native keyboard clicks and synchronizes expanded state', function() {
      expect(controller).to.contain('e.detail === 0');
      expect(controller).to.contain('shown.bs.popover.deductedDaysPopover');
      expect(controller).to.contain("attr('aria-expanded', 'true')");
      expect(controller).to.contain('hidden.bs.popover.deductedDaysPopover');
      expect(controller).to.contain("attr('aria-expanded', 'false')");
      expect(controller).not.to.match(/(?:which|keyCode)\s*===?\s*(?:13|32)/);
      expect(controller).not.to.contain("attr('aria-describedby'");
    });
  });
});
