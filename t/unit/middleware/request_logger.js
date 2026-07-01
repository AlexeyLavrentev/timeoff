'use strict';

var expect = require('chai').expect;
var logger = require('../../../lib/middleware/request_logger');

describe('Structured logger (request_logger)', function() {

  describe('levels', function() {

    it('respects LOG_LEVEL filtering', function() {
      var originalLevel = logger._getLevel();
      try {
        // Set to warn — debug and info should be suppressed
        logger._setLevel(30);

        expect(logger._shouldLog('debug')).to.equal(false);
        expect(logger._shouldLog('info')).to.equal(false);
        expect(logger._shouldLog('warn')).to.equal(true);
        expect(logger._shouldLog('error')).to.equal(true);
      } finally {
        logger._setLevel(originalLevel);
      }
    });
  });

  describe('format', function() {

    it('produces valid JSON with time, level, msg', function() {
      var line = logger._format('info', 'test message');

      var parsed = JSON.parse(line);
      expect(parsed.level).to.equal('info');
      expect(parsed.msg).to.equal('test message');
      expect(parsed.time).to.be.a('string');
    });

    it('merges extra metadata fields', function() {
      var line = logger._format('error', 'boom', {
        requestId: 'abc-123',
        code: 'ECONNREFUSED',
      });

      var parsed = JSON.parse(line);
      expect(parsed.requestId).to.equal('abc-123');
      expect(parsed.code).to.equal('ECONNREFUSED');
    });

    it('does not allow reserved keys to be overwritten by metadata', function() {
      var line = logger._format('info', 'msg', {
        time: 'fake-time',
        level: 'fake-level',
        msg: 'fake-msg',
      });

      var parsed = JSON.parse(line);
      expect(parsed.time).to.not.equal('fake-time');
      expect(parsed.level).to.equal('info');
      expect(parsed.msg).to.equal('msg');
    });

    it('stringifies non-string messages', function() {
      var line = logger._format('info', 42);
      expect(JSON.parse(line).msg).to.equal('42');
    });
  });

  describe('child logger', function() {

    it('attaches metadata to every log call', function() {
      var originalWrite = process.stdout.write.bind(process.stdout);
      var captured = [];

      process.stdout.write = function(chunk) {
        captured.push(chunk);
        return true;
      };

      try {
        var child = logger.child({ requestId: 'req-child-1' });
        child.info('child message', { extra: 'value' });

        expect(captured.length).to.be.greaterThan(0);
        var parsed = JSON.parse(captured[captured.length - 1]);
        expect(parsed.requestId).to.equal('req-child-1');
        expect(parsed.extra).to.equal('value');
        expect(parsed.msg).to.equal('child message');
      } finally {
        process.stdout.write = originalWrite;
      }
    });

    it('allows extra metadata to override child metadata', function() {
      var originalWrite = process.stdout.write.bind(process.stdout);
      var captured = [];

      process.stdout.write = function(chunk) {
        captured.push(chunk);
        return true;
      };

      try {
        var child = logger.child({ requestId: 'base-id', tag: 'original' });
        child.info('msg', { tag: 'overridden' });

        var parsed = JSON.parse(captured[captured.length - 1]);
        expect(parsed.tag).to.equal('overridden');
        expect(parsed.requestId).to.equal('base-id');
      } finally {
        process.stdout.write = originalWrite;
      }
    });
  });
});
