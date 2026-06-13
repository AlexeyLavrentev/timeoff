'use strict';

const config = require('./config');

const DEFAULT_BRANDING = {
  name: 'Leave Management',
  shortName: 'Leave',
  applicationDomain: 'http://app.timeoff.management',
  promotionWebsiteDomain: 'http://timeoff.management',
  logoUrl: '',
  faviconUrl: '/favicon.ico',
};

const firstValue = values => {
  for (let index = 0; index < values.length; index += 1) {
    if (typeof values[index] !== 'undefined' && values[index] !== null && values[index] !== '') {
      return values[index];
    }
  }

  return undefined;
};

const get = () => {
  const configuredBranding = config.get('branding') || {};

  const branding = {
    name: firstValue([process.env.BRAND_NAME, configuredBranding.name, DEFAULT_BRANDING.name]),
    shortName: firstValue([process.env.BRAND_SHORT_NAME, configuredBranding.shortName, configuredBranding.short_name, DEFAULT_BRANDING.shortName]),
    applicationDomain: firstValue([process.env.APPLICATION_DOMAIN, configuredBranding.applicationDomain, configuredBranding.application_domain, config.get('application_domain'), DEFAULT_BRANDING.applicationDomain]),
    promotionWebsiteDomain: firstValue([process.env.PROMOTION_WEBSITE_DOMAIN, configuredBranding.promotionWebsiteDomain, configuredBranding.promotion_website_domain, config.get('promotion_website_domain'), DEFAULT_BRANDING.promotionWebsiteDomain]),
    logoUrl: firstValue([process.env.BRAND_LOGO_URL, configuredBranding.logoUrl, configuredBranding.logo_url, DEFAULT_BRANDING.logoUrl]),
    faviconUrl: firstValue([process.env.BRAND_FAVICON_URL, configuredBranding.faviconUrl, configuredBranding.favicon_url, DEFAULT_BRANDING.faviconUrl]),
  };

  return branding;
};

module.exports = {
  get,
};
