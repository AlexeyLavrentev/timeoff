'use strict';

// Database bootstrap + migration orchestration.
//
// Historically `db_update.js` ran sequelize.sync() to build the base schema on
// an empty database and THEN replayed every migration from scratch. Because the
// sync()-built schema already reflects the current models, replaying historical
// migrations (e.g. addColumn) crashed with "duplicate column". This module fixes
// that: on a fresh database it baselines migrations (marks them applied without
// running them); on an established database it only runs genuinely pending ones.

const Umzug = require('umzug');

const DEFAULT_REQUIRED_BASE_TABLES = [
  'Companies',
  'Departments',
  'LeaveTypes',
  'Users',
  'schedule',
];

function normalizeTableName(table) {
  if (typeof table === 'string') {
    return table;
  }

  if (table && typeof table === 'object') {
    return table.tableName || table.name || '';
  }

  return '';
}

// Build the base schema with sequelize.sync() only when the database is empty or
// missing core tables. Returns true when sync() actually ran.
function bootstrapEmptyDatabase(sequelize, requiredBaseTables) {
  const required = requiredBaseTables || DEFAULT_REQUIRED_BASE_TABLES;
  const queryInterface = sequelize.getQueryInterface();

  return queryInterface.showAllTables().then(function(tables) {
    const existingTables = (tables || [])
      .map(normalizeTableName)
      .filter(Boolean)
      .filter(function(tableName) {
        return tableName !== 'SequelizeMeta';
      });

    const missingBaseTables = required.filter(function(tableName) {
      return existingTables.indexOf(tableName) === -1;
    });

    if (existingTables.length > 0 && missingBaseTables.length === 0) {
      return false;
    }

    return sequelize.sync().then(function() {
      return true;
    });
  });
}

function createUmzug(sequelize, Sequelize, migrationsPath) {
  return new Umzug({
    storage: 'sequelize',
    storageOptions: {
      sequelize: sequelize,
    },
    migrations: {
      path: migrationsPath,
      params: [sequelize.getQueryInterface(), Sequelize],
      pattern: /\.js$/,
    },
  });
}

// Mark every pending migration as applied WITHOUT executing it. Used right after
// a fresh sequelize.sync(), whose schema already reflects all migrations.
function baselineMigrations(umzug) {
  return umzug.pending().then(function(pending) {
    return pending.reduce(function(sequence, migration) {
      return sequence.then(function() {
        return umzug.storage.logMigration(migration.file);
      });
    }, Promise.resolve()).then(function() {
      return pending.map(function(migration) {
        return migration.file;
      });
    });
  });
}

function runPending(umzug) {
  return umzug.up().then(function(migrations) {
    return migrations.map(function(migration) {
      return migration.file || migration;
    });
  });
}

// Orchestrate bootstrap + migrations across one or more migration paths.
// Resolves with { bootstrapped, baselined: [...], applied: [...] }.
function run(options) {
  const sequelize = options.sequelize;
  const Sequelize = options.Sequelize;
  const migrationPaths = options.migrationPaths || [];
  const requiredBaseTables = options.requiredBaseTables;

  return bootstrapEmptyDatabase(sequelize, requiredBaseTables).then(function(bootstrapped) {
    return migrationPaths.reduce(function(sequence, migrationsPath) {
      return sequence.then(function(result) {
        const umzug = createUmzug(sequelize, Sequelize, migrationsPath);
        const action = bootstrapped ? baselineMigrations(umzug) : runPending(umzug);

        return action.then(function(names) {
          if (bootstrapped) {
            result.baselined = result.baselined.concat(names);
          } else {
            result.applied = result.applied.concat(names);
          }

          return result;
        });
      });
    }, Promise.resolve({ bootstrapped: bootstrapped, baselined: [], applied: [] }));
  });
}

module.exports = {
  DEFAULT_REQUIRED_BASE_TABLES,
  bootstrapEmptyDatabase,
  baselineMigrations,
  createUmzug,
  run,
  runPending,
};
