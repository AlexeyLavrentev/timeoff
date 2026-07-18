'use strict';

var expect   = require('chai').expect;
var http     = require('http');
var express  = require('express');
var requestMiddleware = require('../../../lib/middleware/request_id');
var logger = require('../../../lib/middleware/request_logger');

/**
 * Helper: create a minimal Express app with only the request-id middleware
 * attached, then make an HTTP request against it.
 */
function createTestServer(handler) {
  var app = express();
  app.use(requestMiddleware);
  app.get('/test', handler || function(req, res) {
    res.json({ ok: true, requestId: req.requestId });
  });

  return app.listen(0); // random port
}

function httpRequest(port, options) {
  return new Promise(function(resolve, reject) {
    var req = http.request(Object.assign({
      host: '127.0.0.1',
      port: port,
      path: '/test',
      method: 'GET',
    }, options || {}), function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Request ID + HTTP logging middleware', function() {

  describe('request ID generation', function() {

    var server;

    afterEach(function() {
      if (server) { server.close(); server = null; }
    });

    it('assigns a unique requestId to each request', async function() {
      server = createTestServer();

      var port = server.address().port;
      var res1 = await httpRequest(port);
      var res2 = await httpRequest(port);

      var body1 = JSON.parse(res1.body);
      var body2 = JSON.parse(res2.body);

      expect(body1.requestId).to.be.a('string');
      expect(body2.requestId).to.be.a('string');
      expect(body1.requestId).to.not.equal(body2.requestId);
    });

    it('sets X-Request-Id response header', async function() {
      server = createTestServer();

      var res = await httpRequest(server.address().port);

      expect(res.headers['x-request-id']).to.be.a('string');
      expect(res.headers['x-request-id'].length).to.be.greaterThan(10);
    });

    it('reuses X-Request-Id header from client if provided', async function() {
      server = createTestServer();

      var res = await httpRequest(server.address().port, {
        headers: { 'X-Request-Id': 'client-supplied-id-123' },
      });

      expect(res.headers['x-request-id']).to.equal('client-supplied-id-123');

      var body = JSON.parse(res.body);
      expect(body.requestId).to.equal('client-supplied-id-123');
    });

    it('replaces invalid and oversized request IDs', async function() {
      server = createTestServer();
      var invalid = await httpRequest(server.address().port, {
        headers: { 'X-Request-Id': 'bad id with spaces' },
      });
      var oversized = await httpRequest(server.address().port, {
        headers: { 'X-Request-Id': 'x'.repeat(129) },
      });

      expect(invalid.headers['x-request-id']).to.not.equal('bad id with spaces');
      expect(oversized.headers['x-request-id']).to.not.equal('x'.repeat(129));
      expect(invalid.headers['x-request-id']).to.match(/^[0-9a-f-]{36}$/);
    });
  });

  describe('req.log child logger', function() {

    it('attaches a child logger with requestId to req', function() {
      var app = express();
      app.use(requestMiddleware);
      app.get('/test', function(req, res) {
        expect(req.log).to.be.an('object');
        expect(req.log.info).to.be.a('function');
        expect(req.log.error).to.be.a('function');
        res.json({ ok: true });
      });

      return new Promise(function(resolve) {
        var server = app.listen(0, function() {
          httpRequest(server.address().port).then(function() {
            server.close();
            resolve();
          });
        });
      });
    });
  });

  describe('HTTP request logging on finish', function() {

    it('does not log OIDC callback secrets', function() {
      var originalStdout = process.stdout.write.bind(process.stdout);
      var originalLevel = logger._getLevel();
      var originalSilenceHttpLogs = process.env.SILENCE_HTTP_LOGS;
      var captured = [];

      function restore() {
        process.stdout.write = originalStdout;
        logger._setLevel(originalLevel);
        if (originalSilenceHttpLogs === undefined) {
          delete process.env.SILENCE_HTTP_LOGS;
        } else {
          process.env.SILENCE_HTTP_LOGS = originalSilenceHttpLogs;
        }
      }

      return new Promise(function(resolve, reject) {
        logger._setLevel(20);
        delete process.env.SILENCE_HTTP_LOGS;
        process.stdout.write = function(chunk) {
          captured.push(chunk);
          return true;
        };

        var app = express();
        app.use(requestMiddleware);
        app.get('/login/sso/callback', function(req, res) {
          res.redirect('/calendar/');
        });

        var server = app.listen(0, function() {
          httpRequest(server.address().port, {
            path: '/login/sso/callback?code=secret-code&state=secret-state&session_state=secret-session',
          }).then(function() {
            setTimeout(function() {
              restore();
              server.close();

              try {
                var httpLogs = captured
                  .map(function(c) { return c.toString(); })
                  .filter(function(s) { return s.indexOf('http_request') !== -1; });
                var parsed = JSON.parse(httpLogs[httpLogs.length - 1]);

                expect(parsed.path).to.contain('/login/sso/callback');
                expect(parsed.path).to.not.contain('secret-code');
                expect(parsed.path).to.not.contain('secret-state');
                expect(parsed.path).to.not.contain('secret-session');
                resolve();
              } catch(e) {
                reject(e);
              }
            }, 50);
          }).catch(function(error) {
            restore();
            server.close();
            reject(error);
          });
        });
      });
    });

    it('logs request on res finish event', function() {
      var originalStdout = process.stdout.write.bind(process.stdout);
      var originalLevel = logger._getLevel();
      var originalSilenceHttpLogs = process.env.SILENCE_HTTP_LOGS;
      var captured = [];

      function restore() {
        process.stdout.write = originalStdout;
        logger._setLevel(originalLevel);
        if (originalSilenceHttpLogs === undefined) {
          delete process.env.SILENCE_HTTP_LOGS;
        } else {
          process.env.SILENCE_HTTP_LOGS = originalSilenceHttpLogs;
        }
      }

      return new Promise(function(resolve, reject) {
        // Capture stdout
        logger._setLevel(20);
        delete process.env.SILENCE_HTTP_LOGS;
        process.stdout.write = function(chunk) {
          captured.push(chunk);
          return true;
        };

        var app = express();
        app.use(requestMiddleware);
        app.get('/test', function(req, res) { res.json({ ok: true }); });

        var server = app.listen(0, function() {
          var port = server.address().port;
          http.request({
            host: '127.0.0.1',
            port: port,
            path: '/test',
            method: 'GET',
          }, function(res) {
            res.on('end', function() {
              // Give the finish event handler a tick to run
              setTimeout(function() {
                restore();
                server.close();

                try {
                  var httpLogs = captured
                    .map(function(c) { return c.toString(); })
                    .filter(function(s) { return s.indexOf('http_request') !== -1; });

                  expect(httpLogs.length).to.equal(1);

                  var parsed = JSON.parse(httpLogs[httpLogs.length - 1]);
                  expect(parsed.msg).to.equal('http_request');
                  expect(parsed.method).to.equal('GET');
                  expect(parsed.statusCode).to.equal(200);
                  expect(parsed.durationMs).to.be.a('number');
                  expect(parsed.requestId).to.be.a('string');

                  resolve();
                } catch(e) {
                  reject(e);
                }
              }, 50);
            });
            res.resume();
          }).on('error', function(error) {
            restore();
            reject(error);
          }).end();
        });
      });
    });
  });
});
