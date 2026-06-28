'use strict';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
].join('; ');

const setPortalSecurityHeaders = (req, res, next) => {
  const headers = [
    ['Content-Security-Policy', CONTENT_SECURITY_POLICY],
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'same-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
  ];

  if (req.secure) {
    headers.push(['Strict-Transport-Security', 'max-age=31536000; includeSubDomains']);
  }

  headers.forEach(([name, value]) => res.setHeader(name, value));
  next();
};

module.exports = { CONTENT_SECURITY_POLICY, setPortalSecurityHeaders };
