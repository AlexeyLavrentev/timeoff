'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

function filesUnder(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

describe('CSRF form coverage', function() {
  it('places a CSRF field in every server-rendered POST form', function() {
    const failures = [];
    filesUnder(path.join(__dirname, '..', '..', 'views'))
      .filter(file => file.endsWith('.hbs'))
      .forEach(file => {
        const source = fs.readFileSync(file, 'utf8');
        const formPattern = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
        let match;
        while ((match = formPattern.exec(source))) {
          const openingTag = match[0].match(/^<form\b[^>]*>/i)[0];
          if (/method=["']post["']/i.test(openingTag) && !/name=["']_csrf["']/i.test(match[0])) {
            failures.push(path.relative(path.join(__dirname, '..', '..'), file) + ': ' + openingTag);
          }
        }
      });
    expect(failures).to.deep.equal([]);
  });
});
