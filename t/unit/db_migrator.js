'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Sequelize = require('sequelize');
const migrator = require('../../lib/model/migrator');

function writeMigration(dir, name, lines) {
  fs.writeFileSync(path.join(dir, name), lines.join('\n'));
}

const ADD_BAR_MIGRATION = [
  "'use strict';",
  'module.exports = {',
  '  up: function(queryInterface, Sequelize) {',
  "    return queryInterface.addColumn('Foos', 'bar', { type: Sequelize.STRING });",
  '  },',
  '  down: function(queryInterface) {',
  "    return queryInterface.removeColumn('Foos', 'bar');",
  '  },',
  '};',
];

const CREATE_BAZ_MIGRATION = [
  "'use strict';",
  'module.exports = {',
  '  up: function(queryInterface, Sequelize) {',
  "    return queryInterface.createTable('Bazes', {",
  '      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },',
  '    });',
  '  },',
  '  down: function(queryInterface) {',
  "    return queryInterface.dropTable('Bazes');",
  '  },',
  '};',
];

describe('lib/model/db/migrator', function() {
  let migrationsDir;
  let sequelize;

  beforeEach(function() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-'));
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir);

    sequelize = new Sequelize('sqlite::memory:', { logging: false });
    // The model already contains the column that a historical migration adds,
    // exactly like the real app (sync() builds the current schema).
    sequelize.define('Foo', { bar: Sequelize.STRING }, { tableName: 'Foos' });
  });

  afterEach(function() {
    return sequelize.close();
  });

  function runMigrator() {
    return migrator.run({
      sequelize: sequelize,
      Sequelize: Sequelize,
      migrationPaths: [migrationsDir],
      requiredBaseTables: ['Foos'],
    });
  }

  it('fresh install: syncs schema and baselines migrations without running them', function() {
    writeMigration(migrationsDir, '001-add-bar.js', ADD_BAR_MIGRATION);

    // If the migration ran, addColumn('bar') would crash (column already exists
    // from sync()). Resolving cleanly proves it was baselined, not executed.
    return runMigrator().then(function(result) {
      expect(result.bootstrapped).to.equal(true);
      expect(result.baselined).to.include('001-add-bar.js');
      return sequelize.getQueryInterface().describeTable('Foos');
    }).then(function(columns) {
      expect(columns).to.have.property('bar');
    });
  });

  it('repeated run on an already-initialised database is a safe no-op', function() {
    writeMigration(migrationsDir, '001-add-bar.js', ADD_BAR_MIGRATION);

    return runMigrator().then(function() {
      return runMigrator();
    }).then(function(result) {
      expect(result.bootstrapped).to.equal(false);
      expect(result.applied).to.deep.equal([]);
    });
  });

  it('applies genuinely new migrations on an established database', function() {
    writeMigration(migrationsDir, '001-add-bar.js', ADD_BAR_MIGRATION);

    return runMigrator().then(function() {
      // A later release ships a brand-new migration.
      writeMigration(migrationsDir, '002-create-baz.js', CREATE_BAZ_MIGRATION);
      return runMigrator();
    }).then(function(result) {
      expect(result.bootstrapped).to.equal(false);
      expect(result.applied).to.include('002-create-baz.js');
      return sequelize.getQueryInterface().showAllTables();
    }).then(function(tables) {
      const names = tables.map(function(t) {
        return typeof t === 'string' ? t : t.tableName;
      });
      expect(names).to.include('Bazes');
    });
  });
});
