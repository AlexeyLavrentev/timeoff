'use strict';

const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;

const routeSource = fs.readFileSync(
  path.join(__dirname, '../../../lib/route/requests.js'),
  'utf8'
);

const viewSource = fs.readFileSync(
  path.join(__dirname, '../../../views/requests.hbs'),
  'utf8'
);

describe('Bulk approve/reject requests', function() {

  it('registers POST routes for bulk approve and reject', function() {
    expect(routeSource).to.match(/router\.post\(\s*'\/bulk\/approve\/'/);
    expect(routeSource).to.match(/router\.post\(\s*'\/bulk\/reject\/'/);
  });

  it('single and bulk handlers share the same per-leave decision helper', function() {
    // The helper must exist and be referenced from both code paths so the two
    // flows (single button, bulk submit) cannot drift apart.
    expect(routeSource).to.match(/function process_single_decision\(/);
    const helperCalls = routeSource.match(/process_single_decision\(\{/g) || [];
    expect(helperCalls.length).to.be.at.least(2);
  });

  it('bulk handler normalises a single value into an array and keeps only numeric ids', function() {
    expect(routeSource).to.match(/if \(!Array\.isArray\(raw_ids\)\) raw_ids = \[raw_ids\];/);
    expect(routeSource).to.match(/validator\.isNumeric/);
  });

  it('bulk handler only processes ids from the approver pending queue', function() {
    // Guards against acting on ids the approver was not entitled to process.
    expect(routeSource).to.match(/promise_leaves_to_be_processed/);
    expect(routeSource).to.match(/pending_by_id\[String\(request_id\)\]/);
  });

  it('view exposes a bulk action form carrying a CSRF token', function() {
    expect(viewSource).to.match(/id="bulk-action-form"/);
    expect(viewSource).to.match(/<form[^>]*id="bulk-action-form"[\s\S]*?name="_csrf"[\s\S]*?<\/form>/);
  });

  it('view checkboxes are associated with the bulk form and post the request id', function() {
    expect(viewSource).to.match(/class="bulk-request-checkbox"[^>]*name="request"[^>]*form="bulk-action-form"/);
    expect(viewSource).to.match(/class="bulk-select-all"/);
  });

  it('bulk buttons target the dedicated bulk endpoints via formaction', function() {
    expect(viewSource).to.match(/formaction="\/requests\/bulk\/approve\/"/);
    expect(viewSource).to.match(/formaction="\/requests\/bulk\/reject\/"/);
  });
});
