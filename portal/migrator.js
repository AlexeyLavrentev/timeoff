'use strict';

const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');

const MIGRATIONS_PATH = path.join(__dirname, 'migrations');
const META_TABLE = 'PortalSequelizeMeta';

// umzug v3 invokes migrations as up({ context }). The portal migration files keep
// the v2 `up(queryInterface, Sequelize)` signature, so the resolve adapter passes
// the queryInterface (the umzug context) and Sequelize through to them. The glob
// preserves the old digit-prefixed `^\d+...\.js$` pattern.
const createPortalMigrator = (sequelize, Sequelize) => new Umzug({
  migrations: {
    glob: ['[0-9]*.js', { cwd: MIGRATIONS_PATH }],
    resolve: ({ name, path: migrationPath, context }) => {
      const migration = require(migrationPath);
      return {
        name,
        up: () => migration.up(context, Sequelize),
        down: () => migration.down(context, Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: META_TABLE }),
  logger: undefined,
});

const runPortalMigrations = async (models) => {
  const migrator = createPortalMigrator(models.sequelize, models.Sequelize);
  const migrations = await migrator.up();
  return migrations.map(migration => migration.name || migration);
};

module.exports = {
  META_TABLE,
  MIGRATIONS_PATH,
  createPortalMigrator,
  runPortalMigrations,
};
