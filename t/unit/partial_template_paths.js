'use strict';

var expect = require('chai').expect;
var partialTemplatePaths = require('../../lib/partial_template_paths');

describe('Partial template paths', function() {
  afterEach(function() {
    partialTemplatePaths.reset();
  });

  it('keeps core partial path first and removes duplicates', function() {
    var paths = partialTemplatePaths.set([
      '/premium/partials',
      partialTemplatePaths.defaultPartialTemplatePath,
      '/premium/partials',
    ]);

    expect(paths).to.deep.equal([
      partialTemplatePaths.defaultPartialTemplatePath,
      '/premium/partials',
    ]);
    expect(partialTemplatePaths.get()).to.deep.equal(paths);
  });
});
