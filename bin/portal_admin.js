#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const { getPortalConfig, ensureDbDirectory } = require('../portal/config');
const { loadPortalModels } = require('../portal/models');
const { hashPassword } = require('../portal/auth/passwords');
const { VALID_ROLES } = require('../portal/models/admin_user');

const subcommand = argv._[0];

const printUsageAndExit = () => {
  process.stderr.write([
    'LeavePilot Portal Admin CLI',
    '',
    'Usage:',
    '  node bin/portal_admin.js create-admin --email <email> --password <password> [--display-name "..."] [--role admin]',
    '  node bin/portal_admin.js list-admins',
    '  node bin/portal_admin.js disable-admin --email <email>',
    '  node bin/portal_admin.js reset-password --email <email> --password <password>',
    '',
    'Roles: ' + VALID_ROLES.join(', '),
    '',
  ].join('\n'));
  process.exit(1);
};

const getDb = async () => {
  const config = getPortalConfig();
  ensureDbDirectory(config.dbStorage);
  const models = loadPortalModels({ storage: config.dbStorage });
  await models.sequelize.sync();
  return models;
};

const handleCreateAdmin = async () => {
  if (!argv.email || !argv.password) {
    process.stderr.write('Error: --email and --password are required.\n');
    process.exit(1);
  }

  const role = argv.role || 'admin';
  if (!VALID_ROLES.includes(role)) {
    process.stderr.write('Error: --role must be one of: ' + VALID_ROLES.join(', ') + '\n');
    process.exit(1);
  }

  const models = await getDb();

  try {
    const existing = await models.AdminUser.findOne({ where: { email: argv.email.toLowerCase().trim() } });
    if (existing) {
      process.stderr.write('Error: user with this email already exists.\n');
      process.exit(1);
    }

    const user = await models.AdminUser.create({
      email: argv.email.toLowerCase().trim(),
      displayName: argv['display-name'] || null,
      passwordHash: hashPassword(argv.password),
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

const handleListAdmins = async () => {
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
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : 'never';
      console.log('  ' + u.email.padEnd(30) + u.role.padEnd(10) + status.padEnd(10) + 'last login: ' + lastLogin);
    });
  } finally {
    await models.sequelize.close();
  }
};

const handleDisableAdmin = async () => {
  if (!argv.email) {
    process.stderr.write('Error: --email is required.\n');
    process.exit(1);
  }

  const models = await getDb();

  try {
    const user = await models.AdminUser.findOne({ where: { email: argv.email.toLowerCase().trim() } });
    if (!user) {
      process.stderr.write('Error: user not found.\n');
      process.exit(1);
    }

    await user.update({ isActive: false });
    console.log('User disabled: ' + user.email);
  } finally {
    await models.sequelize.close();
  }
};

const handleResetPassword = async () => {
  if (!argv.email || !argv.password) {
    process.stderr.write('Error: --email and --password are required.\n');
    process.exit(1);
  }

  const models = await getDb();

  try {
    const user = await models.AdminUser.findOne({ where: { email: argv.email.toLowerCase().trim() } });
    if (!user) {
      process.stderr.write('Error: user not found.\n');
      process.exit(1);
    }

    await user.update({
      passwordHash: hashPassword(argv.password),
      failedLoginCount: 0,
      lockedUntil: null,
    });

    console.log('Password reset for: ' + user.email);
  } finally {
    await models.sequelize.close();
  }
};

const handlers = {
  'create-admin': handleCreateAdmin,
  'list-admins': handleListAdmins,
  'disable-admin': handleDisableAdmin,
  'reset-password': handleResetPassword,
};

if (!subcommand || !handlers[subcommand]) {
  printUsageAndExit();
}

handlers[subcommand]().catch(error => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
