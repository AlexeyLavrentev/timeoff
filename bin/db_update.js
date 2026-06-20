'use strict';

var path = require('path');
var Umzug = require('umzug');
var db = require('../lib/model/db');
var edition = require('../lib/edition');

function normalizeTableName(table) {
  if (typeof table === 'string') {
    return table;
  }

  if (table && typeof table === 'object') {
    return table.tableName || table.name || '';
  }

  return '';
}

function bootstrapEmptyDatabase(sequelize) {
  var queryInterface = sequelize.getQueryInterface();

  return queryInterface.showAllTables().then(function(tables) {
    var existingTables = (tables || [])
      .map(normalizeTableName)
      .filter(Boolean)
      .filter(function(tableName) {
        return tableName !== 'SequelizeMeta';
      });

    var requiredBaseTables = [
      'Companies',
      'Departments',
      'LeaveTypes',
      'Users',
      'schedule',
    ];
    var missingBaseTables = requiredBaseTables.filter(function(tableName) {
      return existingTables.indexOf(tableName) === -1;
    });

    if (existingTables.length > 0 && missingBaseTables.length === 0) {
      return null;
    }

    console.log(
      existingTables.length === 0
        ? 'Database is empty, creating base schema with sequelize.sync()'
        : 'Database schema is incomplete, creating missing base tables with sequelize.sync(): '
          + missingBaseTables.join(', ')
    );
    return sequelize.sync();
  });
}

function createUmzug(sequelize, migrationsPath) {
  return new Umzug({
    storage: 'sequelize',
    storageOptions: {
      sequelize: sequelize,
    },
    migrations: {
      path: migrationsPath,
      params: [sequelize.getQueryInterface(), db.Sequelize],
      pattern: /\.js$/,
    },
  });
}

function runMigrations(sequelize, migrationsPath) {
  return createUmzug(sequelize, migrationsPath)
    .up()
    .then(function(migrations) {
      return migrations.map(function(migration) {
        return migration.file || migration;
      });
    });
}

db.connect()
  .then(function() {
    var sequelize = db.sequelize;
    var migrationPaths = [path.join(__dirname, '..', 'migrations')]
      .concat(edition.getMigrationPaths())
      .filter(function(migrationsPath, index, allPaths) {
        return allPaths.indexOf(migrationsPath) === index;
      });

    return bootstrapEmptyDatabase(sequelize)
      .then(function() {
        return migrationPaths.reduce(function(sequence, migrationsPath) {
          return sequence.then(function(appliedMigrations) {
            return runMigrations(sequelize, migrationsPath)
              .then(function(migrations) {
                return appliedMigrations.concat(migrations);
              });
          });
        }, Promise.resolve([]));
      })
      .then(function(migrations) {
        console.log('Applied migrations:', migrations.join(', ') || 'none');
      })
      .finally(function() {
        return sequelize.close();
      });
  })
  .catch(function(error) {
    console.error(error && error.stack || error);
    if (error && error.parent) {
      console.error(error.parent && error.parent.stack || error.parent);
    }
    if (error && error.sql) {
      console.error(error.sql);
    }
    if (error && error.parent && error.parent.sql) {
      console.error(error.parent.sql);
    }
    process.exit(1);
  });
