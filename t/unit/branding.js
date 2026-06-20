'use strict';

var expect = require('chai').expect;
var branding = require('../../lib/branding');

describe('Branding', function() {
  var originalEnv = {};

  beforeEach(function() {
    originalEnv = {
      BRAND_NAME : process.env.BRAND_NAME,
      BRAND_SHORT_NAME : process.env.BRAND_SHORT_NAME,
      APPLICATION_DOMAIN : process.env.APPLICATION_DOMAIN,
      PROMOTION_WEBSITE_DOMAIN : process.env.PROMOTION_WEBSITE_DOMAIN,
      BRAND_LOGO_URL : process.env.BRAND_LOGO_URL,
      BRAND_FAVICON_URL : process.env.BRAND_FAVICON_URL,
      BRAND_SENDER_EMAIL : process.env.BRAND_SENDER_EMAIL,
      BRAND_SENDER_NAME : process.env.BRAND_SENDER_NAME,
      BRAND_EMAIL_FROM : process.env.BRAND_EMAIL_FROM,
    };
  });

  afterEach(function() {
    Object.keys(originalEnv).forEach(function(key) {
      if (typeof originalEnv[key] === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  it('returns default branding from app config', function() {
    var currentBranding = branding.get();

    expect(currentBranding.name).to.equal('LeavePilot');
    expect(currentBranding.shortName).to.equal('LeavePilot');
    expect(currentBranding.applicationDomain).to.equal('http://app.timeoff.management');
    expect(currentBranding.promotionWebsiteDomain).to.equal('http://timeoff.management');
    expect(currentBranding.faviconUrl).to.equal('/favicon.ico');
    expect(currentBranding.emailFrom).to.equal('email@test.com');
  });

  it('lets environment variables override customer branding', function() {
    process.env.BRAND_NAME = 'Acme Leave';
    process.env.BRAND_SHORT_NAME = 'Acme';
    process.env.APPLICATION_DOMAIN = 'https://leave.example.com';
    process.env.PROMOTION_WEBSITE_DOMAIN = 'https://example.com';
    process.env.BRAND_LOGO_URL = 'https://cdn.example.com/logo.svg';
    process.env.BRAND_FAVICON_URL = 'https://cdn.example.com/favicon.ico';

    var currentBranding = branding.get();

    expect(currentBranding.name).to.equal('Acme Leave');
    expect(currentBranding.shortName).to.equal('Acme');
    expect(currentBranding.applicationDomain).to.equal('https://leave.example.com');
    expect(currentBranding.promotionWebsiteDomain).to.equal('https://example.com');
    expect(currentBranding.logoUrl).to.equal('https://cdn.example.com/logo.svg');
    expect(currentBranding.faviconUrl).to.equal('https://cdn.example.com/favicon.ico');
  });

  it('formats email sender from branding values', function() {
    process.env.BRAND_SENDER_EMAIL = 'leave@example.com';
    process.env.BRAND_SENDER_NAME = 'Acme Leave';

    expect(branding.getEmailFrom()).to.equal('"Acme Leave" <leave@example.com>');
  });

  it('allows a fully custom email sender value', function() {
    process.env.BRAND_EMAIL_FROM = 'No Reply <noreply@example.com>';

    expect(branding.getEmailFrom()).to.equal('No Reply <noreply@example.com>');
  });
});
