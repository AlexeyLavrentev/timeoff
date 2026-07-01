'use strict';

/**
 * Structured logger — JSON-formatted log output with levels and request ID.
 *
 * Writes JSON lines to stdout/stderr for consumption by Docker logging
 * drivers, ELK, Loki, Datadog, etc.
 *
 * Log levels (controlled by LOG_LEVEL env var):
 *   debug < info < warn < error
 *
 * Each log line includes: timestamp, level, message, requestId (if available),
 * plus any extra fields passed.
 */

var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
var LEVEL_NAMES = ['debug', 'info', 'warn', 'error'];

var currentLevel = LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function shouldLog(level) {
  var val = LEVELS[level];
  return val !== undefined && val >= currentLevel;
}

function format(level, message, meta) {
  var entry = {
    time  : new Date().toISOString(),
    level : level,
    msg   : typeof message === 'string' ? message : String(message),
  };

  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    Object.keys(meta).forEach(function(key) {
      // Don't overwrite reserved keys
      if (key !== 'time' && key !== 'level' && key !== 'msg') {
        entry[key] = meta[key];
      }
    });
  }

  return JSON.stringify(entry);
}

function log(level, message, meta) {
  if (!shouldLog(level)) return;

  var line = format(level, message, meta);

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug : function(msg, meta) { log('debug', msg, meta); },
  info  : function(msg, meta) { log('info', msg, meta); },
  warn  : function(msg, meta) { log('warn', msg, meta); },
  error : function(msg, meta) { log('error', msg, meta); },

  /**
   * Create a child logger that always includes a requestId.
   */
  child : function(meta) {
    return {
      debug : function(msg, extra) { log('debug', msg, Object.assign({}, meta, extra)); },
      info  : function(msg, extra) { log('info', msg, Object.assign({}, meta, extra)); },
      warn  : function(msg, extra) { log('warn', msg, Object.assign({}, meta, extra)); },
      error : function(msg, extra) { log('error', msg, Object.assign({}, meta, extra)); },
    };
  },

  // Expose for testing
  _shouldLog : shouldLog,
  _format    : format,
  _getLevel  : function() { return currentLevel; },
  _setLevel  : function(v) { currentLevel = v; },
};
