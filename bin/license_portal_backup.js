#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const path = require('path');
const { getPortalConfig } = require('../portal/config');

const formatTimestamp = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const run = () => {
  const config = getPortalConfig();

  if (config.dbStorage === ':memory:') {
    console.error('Error: cannot backup in-memory database.');
    process.exit(1);
  }

  if (!fs.existsSync(config.dbStorage)) {
    console.error('Error: database file not found: ' + config.dbStorage);
    process.exit(1);
  }

  const outDir = argv['out-dir'] || path.join(path.dirname(config.dbStorage), '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = formatTimestamp(new Date());
  const backupName = 'portal-' + timestamp + '.sqlite';
  const backupPath = path.join(outDir, backupName);

  if (fs.existsSync(backupPath)) {
    console.error('Error: backup file already exists: ' + backupPath);
    process.exit(1);
  }

  fs.copyFileSync(config.dbStorage, backupPath);

  const stat = fs.statSync(backupPath);
  const dbStat = fs.statSync(config.dbStorage);

  console.log('Backup created successfully:');
  console.log('  file: ' + backupPath);
  console.log('  size: ' + stat.size + ' bytes');
  console.log('  source: ' + config.dbStorage);
  console.log('  source size: ' + dbStat.size + ' bytes');
  console.log('  timestamp: ' + new Date().toISOString());
  console.log('');
  console.log('WARNING: Backup contains admin password hashes and license blobs.');
  console.log('         Store securely and do not expose publicly.');
};

run();
