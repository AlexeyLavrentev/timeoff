'use strict';

// Backfill: encrypt legacy plaintext OIDC client secrets stored inside
// Companies.sso_auth_config (a JSON TEXT column).
// - Idempotent: only re-writes rows whose client_secret is plaintext.
// - Retryable: missing or incorrect key material fails the migration, so Umzug
//   does not record a partially remediated migration as applied.
// - Never logs the secret value.
//
// On a fresh database this migration is baselined (not executed) by the core
// migrator, so it only runs against pre-existing installations.

const backfill = require('../lib/sso_secret_backfill');

module.exports = {
  up: function (queryInterface) {
    return backfill.apply({
      sequelize: queryInterface.sequelize,
      queryInterface: queryInterface,
    }).then(function(summary) {
      process.stdout.write(backfill.formatSummary('migration', summary) + '\n');
      return summary;
      });
  },

  down: function () {
    // Irreversible by design: decrypting back to plaintext would re-introduce
    // the at-rest exposure this migration fixes.
    return Promise.resolve();
  },
};
