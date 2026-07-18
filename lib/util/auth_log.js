'use strict';

const validator = require('./validator');
const requestPath = require('./request_path');

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
    path: requestPath.getSafeRequestPath(req),
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
  const structuredLogger = require('../middleware/request_logger');
  const payload = Object.assign({ event: event }, meta || {});
  structuredLogger[level === 'warning' ? 'warn' : (level || 'info')]('auth_event', payload);
}

module.exports = {
  getErrorMeta,
  getRequestMeta,
  logAuthEvent,
  maskEmail,
};
