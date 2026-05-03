'use strict';

var path = require('path');
var Umzug = require('umzug');
var db = require('../lib/model/db');

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

    if (existingTables.length > 0) {
      return null;
    }

    console.log('Database is empty, creating base schema with sequelize.sync()');
    return sequelize.sync();
  });
}

db.connect()
  .then(function() {
    var sequelize = db.sequelize;
    var umzug = new Umzug({
      storage: 'sequelize',
      storageOptions: {
        sequelize: sequelize,
      },
      migrations: {
        path: path.join(__dirname, '..', 'migrations'),
        params: [sequelize.getQueryInterface(), db.Sequelize],
        pattern: /\.js$/,
      },
    });

    return bootstrapEmptyDatabase(sequelize)
      .then(function() {
        return umzug.up();
      })
      .then(function(migrations) {
        console.log('Applied migrations:', migrations.map(function(migration) {
          return migration.file || migration;
        }).join(', ') || 'none');
      })
      .finally(function() {
        return sequelize.close();
      });
  })
  .catch(function(error) {
    console.error(error && error.stack || error);
    process.exit(1);
  });
