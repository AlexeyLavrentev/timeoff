'use strict';

const expect = require('chai').expect;
const getCompanyAdminByToken = require('../../lib/passport/getCompanyAdminByToken');

describe('Integration API token authentication', function() {
  it('does not expose a rejected token in the error', function() {
    const token = 'secret-integration-token';
    const model = {
      Company: {
        getCompanyByApiToken: function() {
          return Promise.resolve(null);
        },
      },
    };

    return getCompanyAdminByToken({token: token, model: model})
      .then(function() {
        throw new Error('Expected token authentication to fail');
      }, function(error) {
        expect(JSON.stringify(error)).not.to.include(token);
        expect(error.message).not.to.include(token);
      });
  });
});
