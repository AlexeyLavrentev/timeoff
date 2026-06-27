'use strict';

// Backfill: encrypt legacy plaintext OIDC client secrets stored inside
// Companies.sso_auth_config (a JSON TEXT column).
// - Idempotent: only re-writes rows whose client_secret is not already enc:-prefixed.
// - Safe: if no encryption key is configured, it logs a warning and leaves the
//   plaintext in place (reads still work; the next save will encrypt it).
// - Never logs the secret value.
//
// On a fresh database this migration is baselined (not executed) by the core
// migrator, so it only runs against pre-existing installations.

const secretStore = require('../lib/secret_store');

module.exports = {
  up: function (queryInterface) {
    const sequelize = queryInterface.sequelize;

    return sequelize
      .query(
        'SELECT id, sso_auth_config FROM `Companies` WHERE sso_auth_config IS NOT NULL',
        { type: sequelize.QueryTypes.SELECT }
      )
      .then(function (rows) {
        return rows.reduce(function (chain, row) {
          return chain.then(function () {
            let config;

            try {
              config = JSON.parse(row.sso_auth_config);
            } catch (error) {
              return null; // not valid JSON — leave as-is
            }

            if (
              !config
              || typeof config !== 'object'
              || !config.client_secret
              || secretStore.isEncrypted(config.client_secret)
            ) {
              return null; // nothing to encrypt / already encrypted
            }

            try {
              config.client_secret = secretStore.encryptSecret(config.client_secret);
            } catch (error) {
              console.warn(
                'Skipping SSO client secret encryption for company ' + row.id +
                ': encryption key not configured'
              );
              return null;
            }

            return queryInterface.bulkUpdate(
              'Companies',
              { sso_auth_config: JSON.stringify(config) },
              { id: row.id }
            );
          });
        }, Promise.resolve());
      });
  },

  down: function () {
    // Irreversible by design: decrypting back to plaintext would re-introduce
    // the at-rest exposure this migration fixes.
    return Promise.resolve();
  },
};
