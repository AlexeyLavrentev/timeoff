'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

describe('Diagnostics support workflow', function() {
  it('keeps diagnostics routes behind the settings admin middleware', function() {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/route/settings.js'), 'utf8');
    const guard = source.indexOf("router.all(/.*/, require('../middleware/ensure_user_is_admin'))");
    const download = source.indexOf("router.get('/company/diagnostics.json'");
    expect(guard).to.be.greaterThan(-1);
    expect(download).to.be.greaterThan(guard);
    expect(source).to.contain('leavepilot-diagnostics.json');
    expect(source).to.contain("res.type('application/json')");
  });

  it('documents bounded logs and request ID filtering without automatic upload', function() {
    const docs = fs.readFileSync(path.join(__dirname, '../../docs/docker-compose.md'), 'utf8');
    expect(docs).to.contain('docker compose logs --since 30m');
    expect(docs).to.contain("grep 'REQUEST_ID_FROM_RESPONSE'");
    expect(docs).to.contain('никуда не отправляется автоматически');
  });

  it('offers localized download and manual-sharing guidance', function() {
    ['en', 'ru'].forEach(language => {
      const locale = require('../../public/locales/' + language + '/translation.json');
      expect(locale.diagnostics.download).to.be.a('string').and.not.empty;
      expect(locale.diagnostics.supportHelp).to.be.a('string').and.not.empty;
    });
  });
});
