'use strict';

const expect = require('chai').expect;
const store = require('../../../lib/middleware/rate_limit_store');

describe('Distributed rate-limit store', function() {
  beforeEach(function() {
    store.reset();
  });

  it('expires and removes memory entries by TTL', async function() {
    const first = await store.consume({key: 'memory', windowMs: 1000, now: 100});
    const second = await store.consume({key: 'memory', windowMs: 1000, now: 200});
    const reset = await store.consume({key: 'memory', windowMs: 1000, now: 1200});

    expect(first.count).to.equal(1);
    expect(second.count).to.equal(2);
    expect(reset.count).to.equal(1);
    expect(reset.distributed).to.equal(false);
  });

  it('uses atomic Redis counter and TTL when session Redis is ready', async function() {
    let call;
    const redisClient = {
      isReady: true,
      eval: async function(script, options) {
        call = {script, options};
        return [3, 42000];
      },
    };

    const result = await store.consume({key: 'auth:127.0.0.1', windowMs: 60000, redisClient});

    expect(result).to.deep.equal({count: 3, retryAfterMs: 42000, distributed: true});
    expect(call.script).to.equal(store.LUA_CONSUME);
    expect(call.options.keys).to.deep.equal(['leavepilot:rate-limit:auth:127.0.0.1']);
    expect(call.options.arguments).to.deep.equal(['60000']);
  });

  it('falls back to memory when Redis fails', async function() {
    const redisClient = {
      isReady: true,
      eval: async function() { throw new Error('redis unavailable'); },
    };

    const result = await store.consume({key: 'fallback', windowMs: 60000, redisClient});

    expect(result.count).to.equal(1);
    expect(result.distributed).to.equal(false);
  });
});
