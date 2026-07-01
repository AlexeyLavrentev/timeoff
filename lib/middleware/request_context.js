'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

module.exports = {
  run: (context, callback) => storage.run(Object.freeze(Object.assign({}, context)), callback),
  get: () => storage.getStore() || {},
};
