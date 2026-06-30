'use strict';

var path = require('path');
var db = require('../lib/model/db');
var edition = require('../lib/edition');
var migrator = require('../lib/model/migrator');
var ssoSecretBackfill = require('../lib/sso_secret_backfill');

db.connect()
  .then(function() {
    var sequelize = db.sequelize;
    var migrationPaths = [path.join(__dirname, '..', 'migrations')]
      .concat(edition.getMigrationPaths())
      .filter(function(migrationsPath, index, allPaths) {
        return allPaths.indexOf(migrationsPath) === index;
      });

    return migrator.run({
      sequelize: sequelize,
      Sequelize: db.Sequelize,
      migrationPaths: migrationPaths,
    })
      .then(function(result) {
        if (result.bootstrapped) {
          console.log(
            'Fresh database: created base schema and baselined migrations:',
            result.baselined.join(', ') || 'none'
          );
        } else {
          console.log('Applied migrations:', result.applied.join(', ') || 'none');
        }
        return ssoSecretBackfill.audit({ sequelize: sequelize });
      })
      .then(function(summary) {
        process.stdout.write(ssoSecretBackfill.formatSummary('startup audit', summary) + '\n');
        if (summary.plaintext > 0 || summary.decryptionFailed > 0) {
          process.stderr.write(
            'Run `npm run sso-secret-backfill -- --dry-run` and remediate before enabling SSO.\n'
          );
        }
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
