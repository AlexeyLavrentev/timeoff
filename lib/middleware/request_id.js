'use strict';

/**
 * Request ID + HTTP request logging middleware.
 *
 * Assigns a unique ID to every request. If the client sends
 * X-Request-Id header, it's reused; otherwise a new UUID is generated.
 *
 * Exposes the ID on:
 *   - req.requestId
 *   - res.locals.requestId (for templates)
 *   - res.setHeader('X-Request-Id', ...) (response header)
 *   - req.log (child logger with requestId pre-attached)
 *
 * Also logs every HTTP request on response completion (res 'finish' event)
 * with method, path, status code and duration in milliseconds.
 */

var crypto = require('crypto');
var logger = require('./request_logger');

// Paths that are too noisy to log at info level (health checks, static assets).
var QUIET_PATH_PATTERN = /^\/(?:public\/|favicon)/;

function generateRequestId() {
  return crypto.randomUUID();
}

function requestIdMiddleware(req, res, next) {
  var requestId = req.headers['x-request-id'] || generateRequestId();
  var startTime = process.hrtime();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Attach a child logger with requestId pre-filled
  req.log = logger.child({ requestId: requestId });

  // Log the completed request
  res.on('finish', function() {
    var diff = process.hrtime(startTime);
    var durationMs = Math.round(diff[0] * 1e3 + diff[1] / 1e6);
    var level = res.statusCode >= 500
      ? 'error'
      : res.statusCode >= 400
        ? 'warn'
        : 'info';

    var isQuiet = QUIET_PATH_PATTERN.test(req.originalUrl || req.url || '');

    if (level === 'error' || level === 'warn' || !isQuiet) {
      logger[level]('http_request', {
        requestId   : requestId,
        method      : req.method,
        path        : req.originalUrl || req.url,
        statusCode  : res.statusCode,
        durationMs  : durationMs,
        ip          : req.ip,
      });
    }
  });

  next();
}

module.exports = requestIdMiddleware;
