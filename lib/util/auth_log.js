'use strict';

const validator = require('validator');

function maskEmail(email) {
  const normalizedEmail = validator.trim(String(email || '')).toLowerCase();

  if (!normalizedEmail || normalizedEmail.indexOf('@') === -1) {
    return normalizedEmail || null;
  }

  const parts = normalizedEmail.split('@');
  const localPart = parts[0];
  const domain = parts[1];

  return (localPart ? localPart.charAt(0) : '*') + '***@' + domain;
}

function getRequestMeta(req) {
  return {
    ip: req && req.ip || null,
    method: req && req.method || null,
    path: req && req.originalUrl || req && req.url || null,
  };
}

function getErrorMeta(error) {
  if (!error) {
    return null;
  }

  return {
    message: error.message || String(error),
    code: error.code || null,
  };
}

function logAuthEvent(level, event, meta) {
  const logger = console[level] || console.log;
  const payload = Object.assign({
    event: event,
  }, meta || {});

  logger('[auth]', JSON.stringify(payload));
}

module.exports = {
  getErrorMeta,
  getRequestMeta,
  logAuthEvent,
  maskEmail,
};
