'use strict';

const expect = require('chai').expect;
const serverListener = require('../../lib/server_listener');

describe('HTTP server listener', function() {
  it('resolves with the listening server', async function() {
    const expectedServer = {address: () => ({port: 3000})};
    const app = {
      listen(port, host, done) {
        expect(port).to.equal(3000);
        expect(host).to.equal('127.0.0.1');
        setImmediate(() => done());
        return expectedServer;
      },
    };

    const server = await serverListener.listen({
      app,
      port: 3000,
      host: '127.0.0.1',
    });

    expect(server).to.equal(expectedServer);
  });

  it('rejects an Express 5 listen error', async function() {
    const listenError = new Error('address already in use');
    const app = {
      listen(_port, _host, done) {
        setImmediate(() => done(listenError));
        return {};
      },
    };

    let rejected;
    try {
      await serverListener.listen({app, port: 3000, host: '127.0.0.1'});
    } catch (error) {
      rejected = error;
    }

    expect(rejected).to.equal(listenError);
  });
});
