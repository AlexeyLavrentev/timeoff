'use strict';

const fs = require('fs');
const path = require('path');
const {expect} = require('chai');

const read = relativePath => fs.readFileSync(
  path.join(__dirname, '..', '..', relativePath),
  'utf8'
);

describe('Mobile card tables', function() {
  it('renders approval requests as labelled cards on small screens', function() {
    const view = read('views/requests.hbs');

    expect(view).to.include('mobile-card-table-container');
    expect(view).to.include('requests-to-approve-table mobile-card-table');
    for (const key of [
      'requests.employee',
      'requests.department',
      'requests.requestDate',
      'requests.leaveDates',
      'requests.type',
      'requests.days',
      'requests.comment',
    ]) {
      expect(view).to.include(`data-label="{{t '${key}'}}"`);
    }
    expect(view).to.not.include('requests.scrollTable');
  });

  it('defines a no-horizontal-scroll mobile card layout', function() {
    const stylesheet = read('scss/main.scss');

    expect(stylesheet).to.include('.mobile-card-table-container');
    expect(stylesheet).to.match(/\.mobile-card-table-container\s*\{[^}]*overflow:\s*visible/s);
    expect(stylesheet).to.match(/\.mobile-card-table > tbody > tr > td\s*\{[^}]*display:\s*grid/s);
    expect(stylesheet).to.include('content: attr(data-label)');
  });
});
