'use strict';

const normalizeTableName = table => {
  if (typeof table === 'string') return table;
  return table && (table.tableName || table.name) || '';
};

const hasTable = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables.map(normalizeTableName).includes(tableName);
};

const createIfMissing = async (queryInterface, tableName, columns) => {
  if (await hasTable(queryInterface, tableName)) return false;
  await queryInterface.createTable(tableName, columns);
  return true;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const timestamps = {
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    };

    await createIfMissing(queryInterface, 'admin_users', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      displayName: { type: DataTypes.STRING, allowNull: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'viewer' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      failedLoginCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lockedUntil: { type: DataTypes.DATE, allowNull: true },
      authRevision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'customers', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      contactEmail: { type: DataTypes.STRING, allowNull: true },
      contactName: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'plans', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: { type: DataTypes.STRING, allowNull: true },
      features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'import_batches', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      fileName: { type: DataTypes.STRING, allowNull: true },
      totalEntries: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      importedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      skippedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      dryRun: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      actorName: { type: DataTypes.STRING, allowNull: true },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'licenses', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'customers', key: 'id' },
      },
      planId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'plans', key: 'id' },
      },
      features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      algorithm: { type: DataTypes.STRING, allowNull: false, defaultValue: 'RSA-SHA256' },
      payloadHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      licenseHash: { type: DataTypes.STRING(64), allowNull: true, unique: true },
      licensePayload: { type: DataTypes.TEXT, allowNull: true },
      issuedAt: { type: DataTypes.DATE, allowNull: false },
      actorName: { type: DataTypes.STRING, allowNull: true },
      importBatchId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'import_batches', key: 'id' },
      },
      metadata: { type: DataTypes.JSON, allowNull: true },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'audit_logs', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      actorName: { type: DataTypes.STRING, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.UUID, allowNull: true },
      details: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    });

    await createIfMissing(queryInterface, 'signing_key_references', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      providerType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'file' },
      publicKeyPem: { type: DataTypes.TEXT, allowNull: true },
      kmsKeyId: { type: DataTypes.STRING, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps,
    });

    await createIfMissing(queryInterface, 'portal_sessions', {
      sid: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      expires: { type: DataTypes.DATE, allowNull: true },
      data: { type: DataTypes.TEXT, allowNull: true },
    });
  },

  down: async () => {
    throw new Error('Initial Portal schema migration is irreversible by design');
  },
};

module.exports.hasTable = hasTable;
module.exports.createIfMissing = createIfMissing;
