'use strict';

var expect = require('chai').expect;
var fs = require('fs');
var os = require('os');
var path = require('path');

var emailTemplatePaths = require('../../lib/email_template_paths');
var Email = require('../../lib/email');

describe('Email template paths', function() {
  var tempDir;

  beforeEach(function() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeoff-email-templates-'));
    emailTemplatePaths.reset();
  });

  afterEach(function() {
    emailTemplatePaths.reset();
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  it('renders templates from registered premium email directories', async function() {
    fs.writeFileSync(
      path.join(tempDir, 'premium_notice.hbs'),
      'Premium subject\n=====\n<p>Hello {{name}}</p>'
    );
    emailTemplatePaths.set([tempDir]);

    var renderedEmail = await (new Email()).promise_rendered_email_template({
      template_name: 'premium_notice',
      context: {
        name: 'Ada',
      },
    });

    expect(renderedEmail.subject).to.equal('Premium subject');
    expect(renderedEmail.body).to.match(/Hello Ada/);
  });
});
