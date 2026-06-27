#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const { getPortalConfig, ensureDbDirectory } = require('../portal/config');
const { loadPortalModels } = require('../portal/models');
const { hashPassword } = require('../portal/auth/passwords');
const { VALID_ROLES } = require('../portal/models/admin_user');

const subcommand = argv._[0];
const MIN_PASSWORD_LENGTH = 12;

const printUsageAndExit = () => {
  process.stderr.write([
    'LeavePilot Portal Admin CLI',
    '',
    'Usage:',
    '  node bin/portal_admin.js create --email <email> --password-env <ENV_VAR> [--display-name "..."] [--role admin]',
    '  node bin/portal_admin.js list',
    '  node bin/portal_admin.js disable --email <email>',
    '  node bin/portal_admin.js reset-password --email <email> --password-env <ENV_VAR>',
    '',
    'Password is read from the environment variable specified by --password-env.',
    'Do NOT pass passwords as command-line arguments.',
    '',
    'Roles: ' + VALID_ROLES.join(', '),
    '',
  ].join('\n'));
  process.exit(1);
};

const getPasswordFromEnv = () => {
  const envName = argv['password-env'];
  if (!envName) {
    process.stderr.write('Error: --password-env <ENV_VAR> is required. Do not pass passwords as CLI arguments.\n');
    process.exit(1);
  }

  const password = process.env[envName];
  if (!password) {
    process.stderr.write('Error: environment variable ' + envName + ' is not set or is empty.\n');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    process.stderr.write('Error: password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.\n');
    process.exit(1);
  }

  return password;
};

const getDb = async () => {
  const config = getPortalConfig();
  ensureDbDirectory(config.dbStorage);
  const models = loadPortalModels({ storage: config.dbStorage });
  await models.sequelize.sync();
  return models;
};

const handleCreate = async () => {
  if (!argv.email) {
    process.stderr.write('Error: --email is required.\n');
    process.exit(1);
  }

  const password = getPasswordFromEnv();
  const role = argv.role || 'admin';

  if (!VALID_ROLES.includes(role)) {
    process.stderr.write('Error: --role must be one of: ' + VALID_ROLES.join(', ') + '\n');
    process.exit(1);
  }

  const models = await getDb();

  try {
    const email = argv.email.toLowerCase().trim();
    const existing = await models.AdminUser.findOne({ where: { email } });
    if (existing) {
      process.stderr.write('Error: user with email ' + email + ' already exists.\n');
      process.exit(1);
    }

    const user = await models.AdminUser.create({
      email,
      displayName: argv['display-name'] || null,
      passwordHash: hashPassword(password),
      role,
    });

    console.log('Admin user created:');
    console.log('  email: ' + user.email);
    console.log('  role: ' + user.role);
    console.log('  id: ' + user.id);
  } finally {
    await models.sequelize.close();
  }
};

const handleList = async () => {
  const models = await getDb();

  try {
    const users = await models.AdminUser.findAll({
      order: [['email', 'ASC']],
    });

    if (users.length === 0) {
      console.log('No admin users found.');
      return;
    }

    console.log('Admin users (' + users.length + '):\n');
    users.forEach(u => {
      const status = u.isActive ? 'active' : 'DISABLED';
      const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date() ? ' (locked)' : '';
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : 'never';
      console.log('  ' + u.email.padEnd(30) + u.role.padEnd(10) + (status + locked).padEnd(14) + 'last login: ' + lastLogin);
    });
  } finally {
    await models.sequelize.close();
  }
};

const handleDisable = async () => {
  if (!argv.email) {
    process.stderr.write('Error: --email is required.\n');
    process.exit(1);
  }

  const models = await getDb();

  try {
    const email = argv.email.toLowerCase().trim();
    const user = await models.AdminUser.findOne({ where: { email } });
    if (!user) {
      process.stderr.write('Error: user not found: ' + email + '\n');
      process.exit(1);
    }

    await user.update({ isActive: false });
    console.log('User disabled: ' + user.email);
  } finally {
    await models.sequelize.close();
  }
};

const handleResetPassword = async () => {
  if (!argv.email) {
    process.stderr.write('Error: --email is required.\n');
    process.exit(1);
  }

  const password = getPasswordFromEnv();
  const models = await getDb();

  try {
    const email = argv.email.toLowerCase().trim();
    const user = await models.AdminUser.findOne({ where: { email } });
    if (!user) {
      process.stderr.write('Error: user not found: ' + email + '\n');
      process.exit(1);
    }

    await user.update({
      passwordHash: hashPassword(password),
      failedLoginCount: 0,
      lockedUntil: null,
    });

    console.log('Password reset for: ' + user.email);
  } finally {
    await models.sequelize.close();
  }
};

const handlers = {
  create: handleCreate,
  list: handleList,
  disable: handleDisable,
  'reset-password': handleResetPassword,
};

if (!subcommand || !handlers[subcommand]) {
  printUsageAndExit();
}

handlers[subcommand]().catch(error => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
