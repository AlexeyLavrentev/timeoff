'use strict';

var expect = require('chai').expect;
var requestPath = require('../../lib/util/request_path');

describe('Safe request path', function() {
  it('removes query parameters from fallback request URLs', function() {
    expect(requestPath.getSafeRequestPath({
      originalUrl: '/login/sso/callback?code=secret-code&state=secret-state',
    })).to.equal('/login/sso/callback');
  });

  it('uses the query-free Express path when available', function() {
    expect(requestPath.getSafeRequestPath({
      path: '/login/sso/callback',
      originalUrl: '/login/sso/callback?code=secret-code',
    })).to.equal('/login/sso/callback');
  });

  it('returns null when no request path is available', function() {
    expect(requestPath.getSafeRequestPath()).to.equal(null);
    expect(requestPath.getSafeRequestPath({})).to.equal(null);
  });
});
