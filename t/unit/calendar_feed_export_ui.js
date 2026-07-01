'use strict';

const fs = require('fs');
const path = require('path');
const {expect} = require('chai');

describe('Calendar feed export UI', function() {
  const template = fs.readFileSync(path.join(__dirname, '../../views/feeds_list.hbs'), 'utf8');

  it('builds copied feed URLs from the request protocol and host', function() {
    expect(template).to.contain('{{current_protocol}}://{{current_host}}/feed/');
    expect(template).to.not.contain('<code id="calendar-feed-url">https://');
  });

  it('reports fallback copy failure instead of claiming success', function() {
    expect(template).to.contain("Boolean(document.execCommand('copy'))");
    expect(template).to.contain('data-copy-failure');
    expect(template).to.contain('aria-live="polite"');
  });
});
