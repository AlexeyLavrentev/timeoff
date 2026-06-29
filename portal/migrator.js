'use strict';

const path = require('path');
const Umzug = require('umzug');

const MIGRATIONS_PATH = path.join(__dirname, 'migrations');
const META_TABLE = 'PortalSequelizeMeta';

const createPortalMigrator = (sequelize, Sequelize) => new Umzug({
  storage: 'sequelize',
  storageOptions: {
    sequelize,
    tableName: META_TABLE,
  },
  migrations: {
    path: MIGRATIONS_PATH,
    params: [sequelize.getQueryInterface(), Sequelize],
    pattern: /^\d+[^/]*\.js$/,
  },
});

const runPortalMigrations = async (models) => {
  const migrator = createPortalMigrator(models.sequelize, models.Sequelize);
  const migrations = await migrator.up();
  return migrations.map(migration => migration.file || migration);
};

module.exports = {
  META_TABLE,
  MIGRATIONS_PATH,
  createPortalMigrator,
  runPortalMigrations,
};
