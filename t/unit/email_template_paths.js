'use strict';

var expect = require('chai').expect;
var fs = require('fs');
var os = require('os');
var path = require('path');

var emailTemplatePaths = require('../../lib/email_template_paths');
var Email = require('../../lib/email');
var i18n = require('../../lib/i18n');

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

  it('renders bundled premium time balance email from premium directory', async function() {
    var bundledPremiumTranslations = JSON.parse(fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'lib',
        'edition',
        'bundled_premium',
        'locales',
        'en',
        'translation.json'
      ),
      'utf8'
    ));

    i18n.i18next.addResourceBundle('en', 'translation', bundledPremiumTranslations, true, true);
    emailTemplatePaths.set([
      path.join(__dirname, '..', '..', 'lib', 'edition', 'bundled_premium', 'email'),
    ]);

    var renderedEmail = await (new Email()).promise_rendered_email_template({
      template_name: 'time_balance_request_to_supervisor',
      context: {
        entry: {
          entry_type: 'time_off',
          hours: 4,
        },
        supervisor: {
          name: 'Jane',
          lastname: 'Boss',
        },
        requester: {
          name: 'John',
          lastname: 'Doe',
        },
        user: {
          reload_with_session_details: function() { return Promise.resolve(this); },
        },
      },
    });

    expect(renderedEmail.subject).to.equal('New time balance request');
    expect(renderedEmail.body).to.match(/John Doe/);
    expect(renderedEmail.body).to.match(/4 hours/);
  });
});
