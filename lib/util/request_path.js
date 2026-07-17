'use strict';

function stripQueryString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const queryIndex = value.indexOf('?');
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function getSafeRequestPath(req) {
  if (!req) {
    return null;
  }

  if (typeof req.path === 'string') {
    return req.path;
  }

  return stripQueryString(req.originalUrl || req.url);
}

module.exports = {
  getSafeRequestPath,
};
