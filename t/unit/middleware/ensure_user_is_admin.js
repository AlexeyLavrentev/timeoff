'use strict';

const expect = require('chai').expect;
const ensureUserIsAdmin = require('../../../lib/middleware/ensure_user_is_admin');

describe('ensure user is admin middleware', function() {
  it('allows administrators through', function(done) {
    const req = {
      user: {
        is_admin: () => true,
      },
    };

    ensureUserIsAdmin(req, {}, done);
  });

  it('explains why an authenticated non-admin was redirected', function() {
    const errors = [];
    const redirects = [];
    const req = {
      user: {
        is_admin: () => false,
      },
      session: {
        flash_error(message) {
          errors.push(message);
        },
      },
      t(key) {
        expect(key).to.equal('errors.adminRequired');
        return 'Administrator access is required for this page.';
      },
    };
    const res = {
      redirect_with_session(status, location) {
        redirects.push({status, location});
      },
    };

    ensureUserIsAdmin(req, res, function() {
      throw new Error('next should not be called');
    });

    expect(errors).to.deep.equal([
      'Administrator access is required for this page.',
    ]);
    expect(redirects).to.deep.equal([
      {status: 303, location: '/'},
    ]);
  });

  it('redirects guests without claiming they are missing an admin role', function() {
    const redirects = [];
    const res = {
      redirect_with_session(status, location) {
        redirects.push({status, location});
      },
    };

    ensureUserIsAdmin({user: null}, res, function() {
      throw new Error('next should not be called');
    });

    expect(redirects).to.deep.equal([
      {status: 303, location: '/'},
    ]);
  });
});
