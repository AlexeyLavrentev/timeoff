'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

describe('Employee summary popover trigger markup (requests page)', function() {
  const viewPath = path.join(__dirname, '..', '..', 'views', 'requests.hbs');
  const source = fs.readFileSync(viewPath, 'utf8');

  it('replaces the legacy non-interactive <i> trigger with a real <button>', function() {
    // The old pattern must be gone entirely — no keyboard-inaccessible <i>
    // carrying the trigger class.
    expect(source).not.to.match(
      /<i[^>]*class="[^"]*user-details-summary-trigger[^"]*"/
    );
  });

  it('uses a <button type="button"> as the trigger', function() {
    expect(source).to.match(
      /<button[^>]*type="button"[^>]*class="[^"]*user-details-summary-trigger[^"]*details-trigger-button[^"]*"/
    );
  });

  it('keeps the user-details-summary-trigger class (JS selector contract)', function() {
    expect(source).to.match(
      /<button[^>]*class="[^"]*user-details-summary-trigger[^"]*"/
    );
  });

  it('carries the requests-page marker class so the manual controller only drives this button', function() {
    // The marker scopes the keyboard/click controller to the Requests trigger
    // and prevents it from initialising on Team View <td> triggers that share
    // user-details-summary-trigger.
    expect(source).to.match(
      /<button[^>]*class="[^"]*\brequests-user-details-summary-trigger\b[^"]*"/
    );
  });

  it('uses all three expected classes together', function() {
    expect(source).to.match(
      /<button[^>]*class="user-details-summary-trigger requests-user-details-summary-trigger details-trigger-button"/
    );
  });

  it('preserves data-user-id bound to the user being summarised', function() {
    expect(source).to.match(/<button[^>]*data-user-id="\{\{this\.id\}}"/);
  });

  it('exposes an accessible name built from the localised label + user name', function() {
    // aria-label must reference the existing key and interpolate the name.
    expect(source).to.match(
      /aria-label="\{\{t 'user\.employeeSummary'\}\}: \{\{this\.full_name\}\}"/
    );
  });

  it('keeps the Font Awesome icon purely decorative', function() {
    // The visible icon stays aria-hidden so screen readers rely on the
    // button's accessible name rather than announcing the glyph.
    expect(source).to.match(
      /<span class="fa fa-question-circle" aria-hidden="true"><\/span>/
    );
  });

  it('does not add redundant ARIA wiring that Bootstrap already manages', function() {
    // Bootstrap 3.3.4 sets aria-describedby and the .popover[role=tooltip]
    // itself; we must not duplicate that on the trigger.
    const buttonMatch = source.match(
      /<button[^>]*class="[^"]*user-details-summary-trigger[^"]*"[^>]*>/
    );
    expect(buttonMatch, 'expected the trigger button to exist').to.not.be.null;
    const buttonTag = buttonMatch[0];
    expect(buttonTag).to.not.contain('aria-describedby');
    expect(buttonTag).to.not.contain('aria-expanded');
    expect(buttonTag).to.not.contain('aria-haspopup');
    expect(buttonTag).to.not.contain('role=');
  });
});
