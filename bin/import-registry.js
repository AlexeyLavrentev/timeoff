#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const path = require('path');
const { loadPortalModels } = require('../portal/models');
const { importRegistry } = require('../portal/import/registry_importer');

const printUsageAndExit = () => {
  process.stderr.write([
    'LeavePilot Registry Import CLI',
    '',
    'Usage:',
    '  node bin/import-registry.js --registry <file> [--db <sqlite-path>] [--dry-run] [--actor <name>]',
    '',
    'Options:',
    '  --registry <file>   Path to registry.json file (required)',
    '  --db <path>         Path to portal SQLite database (default: data/portal.sqlite)',
    '  --dry-run           Validate only, do not write to database',
    '  --actor <name>      Actor name for audit log (default: import-cli)',
    '',
  ].join('\n'));
  process.exit(1);
};

const run = async () => {
  if (!argv.registry) {
    process.stderr.write('Error: --registry is required.\n\n');
    printUsageAndExit();
  }

  const registryPath = path.resolve(argv.registry);

  if (!fs.existsSync(registryPath)) {
    process.stderr.write('Error: registry file not found: ' + registryPath + '\n');
    process.exit(1);
  }

  let registryData;
  try {
    registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    process.stderr.write('Error: cannot parse registry file: ' + error.message + '\n');
    process.exit(1);
  }

  const models = loadPortalModels({
    storage: argv.db ? path.resolve(argv.db) : undefined,
  });

  await models.sequelize.sync();

  const result = await importRegistry(registryData, models, {
    dryRun: !!argv['dry-run'],
    actorName: argv.actor || 'import-cli',
    fileName: path.basename(registryPath),
  });

  await models.sequelize.close();

  if (!result.success) {
    process.stderr.write('Import failed:\n');
    result.errors.forEach(err => process.stderr.write('  ' + err + '\n'));
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));

  if (result.dryRun) {
    process.stderr.write('\nDry run complete. Use without --dry-run to import.\n');
  } else {
    process.stderr.write('\nImport complete: ' + result.importedCount + ' imported, ' + result.skippedCount + ' skipped.\n');
  }
};

run().catch(error => {
  process.stderr.write('Fatal: ' + error.message + '\n');
  process.exit(1);
});
