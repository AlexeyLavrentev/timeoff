'use strict';

var path = require('path');
var Umzug = require('umzug');
var db = require('../lib/model/db');

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

    return umzug.up()
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
