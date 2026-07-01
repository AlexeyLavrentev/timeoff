'use strict';

var expect = require('chai').expect;
var EditionRegistry = require('../../lib/edition/registry');

describe('Supervised department seam', function() {

  describe('Registry', function() {
    it('returns null when no provider registered', function() {
      var registry = new EditionRegistry();
      expect(registry.getSupervisedDepartmentProvider()).to.equal(null);
    });

    it('registers and retrieves a provider', function() {
      var registry = new EditionRegistry();
      var provider = {
        getDepartmentIds: function() { return []; },
      };

      registry.registerSupervisedDepartmentProvider(provider);
      expect(registry.getSupervisedDepartmentProvider()).to.equal(provider);
    });

    it('throws when provider lacks getDepartmentIds', function() {
      var registry = new EditionRegistry();
      expect(function() {
        registry.registerSupervisedDepartmentProvider({});
      }).to.throw('Supervised department provider must have getDepartmentIds');
    });

    it('throws when provider is null', function() {
      var registry = new EditionRegistry();
      expect(function() {
        registry.registerSupervisedDepartmentProvider(null);
      }).to.throw('Supervised department provider must have getDepartmentIds');
    });
  });

  describe('Facade getSupervisedDepartmentIds', function() {
    it('returns [] without provider (community default)', function() {
      var edition = require('../../lib/edition');
      return edition.getSupervisedDepartmentIds({user: {id: 1}})
        .then(function(result) {
          expect(result).to.deep.equal([]);
        });
    });

    it('returns [] when provider throws sync', function() {
      var edition = require('../../lib/edition');
      var registry = edition.getRegistry();

      registry.registerSupervisedDepartmentProvider({
        getDepartmentIds: function() {
          throw new Error('sync boom');
        },
      });

      return edition.getSupervisedDepartmentIds({user: {id: 1}})
        .then(function(result) {
          expect(result).to.deep.equal([]);
          registry._supervisedDepartmentProvider = null;
        });
    });

    it('returns [] when provider returns rejected promise', function() {
      var edition = require('../../lib/edition');
      var registry = edition.getRegistry();
      var logger = require('../../lib/middleware/request_logger');
      var origError = logger.error;
      var logged = [];
      logger.error = function(msg, meta) { logged.push({msg: msg, meta: meta}); };

      registry.registerSupervisedDepartmentProvider({
        getDepartmentIds: function() {
          return Promise.reject(new Error('async boom'));
        },
      });

      return edition.getSupervisedDepartmentIds({user: {id: 1}})
        .then(function(result) {
          logger.error = origError;
          expect(result).to.deep.equal([]);
          var found = logged.some(function(entry) {
            return entry.meta && entry.meta.message && entry.meta.message.indexOf('async boom') !== -1;
          });
          expect(found).to.equal(true);
          registry._supervisedDepartmentProvider = null;
        });
    });

    it('passes through provider result on success', function() {
      var edition = require('../../lib/edition');
      var registry = edition.getRegistry();

      registry.registerSupervisedDepartmentProvider({
        getDepartmentIds: function(args) {
          return [10, 20, 30];
        },
      });

      return edition.getSupervisedDepartmentIds({user: {id: 1}})
        .then(function(result) {
          expect(result).to.deep.equal([10, 20, 30]);
          registry._supervisedDepartmentProvider = null;
        });
    });

    it('passes through async provider result on success', function() {
      var edition = require('../../lib/edition');
      var registry = edition.getRegistry();

      registry.registerSupervisedDepartmentProvider({
        getDepartmentIds: function(args) {
          return Promise.resolve([42]);
        },
      });

      return edition.getSupervisedDepartmentIds({user: {id: 1}})
        .then(function(result) {
          expect(result).to.deep.equal([42]);
          registry._supervisedDepartmentProvider = null;
        });
    });
  });
});
