'use strict';

const expect = require('chai').expect;
const helpers = require('../../lib/view/helpers')();

describe('Inline JSON view helper', function() {
  it('preserves ordinary JSON values', function() {
    const output = helpers.json({name: 'LeavePilot', enabled: true, count: 3});

    expect(JSON.parse(output)).to.deep.equal({
      name: 'LeavePilot',
      enabled: true,
      count: 3,
    });
    expect(helpers.json(undefined)).to.equal(undefined);
  });

  it('escapes script-closing and HTML-significant characters', function() {
    const output = helpers.json({value: '</script><img src=x>&'});

    expect(output).not.to.include('<');
    expect(output).not.to.include('>');
    expect(output).not.to.include('&');
    expect(output).to.include('\\u003c/script\\u003e');
    expect(JSON.parse(output).value).to.equal('</script><img src=x>&');
  });

  it('escapes JavaScript line and paragraph separators', function() {
    const output = helpers.json({value: 'before\u2028middle\u2029after'});

    expect(output).not.to.include('\u2028');
    expect(output).not.to.include('\u2029');
    expect(output).to.include('\\u2028');
    expect(output).to.include('\\u2029');
    expect(JSON.parse(output).value).to.equal('before\u2028middle\u2029after');
  });
});
