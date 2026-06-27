'use strict';

const crypto = require('crypto');

const REQUIRED_FIELDS = ['customer', 'features', 'payloadHash'];
const MAX_ENTRY_LENGTH = 10000;
const HEX64_RE = /^[0-9a-f]{64}$/i;

const validateEntry = (entry, index) => {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry at index ' + index + ' is not an object'] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!entry[field]) {
      errors.push('entry at index ' + index + ': missing required field "' + field + '"');
    }
  }

  if (entry.features && !Array.isArray(entry.features)) {
    errors.push('entry at index ' + index + ': "features" must be an array');
  }

  if (entry.payloadHash) {
    if (typeof entry.payloadHash !== 'string' || !HEX64_RE.test(entry.payloadHash)) {
      errors.push('entry at index ' + index + ': "payloadHash" must be a 64-character hex string');
    }
  }

  if (entry.licenseHash) {
    if (typeof entry.licenseHash !== 'string' || !HEX64_RE.test(entry.licenseHash)) {
      errors.push('entry at index ' + index + ': "licenseHash" must be a 64-character hex string');
    }
  }

  if (entry.expires) {
    if (Number.isNaN(Date.parse(entry.expires))) {
      errors.push('entry at index ' + index + ': "expires" is not a valid date');
    }
  }

  if (entry.issuedAt) {
    if (Number.isNaN(Date.parse(entry.issuedAt))) {
      errors.push('entry at index ' + index + ': "issuedAt" is not a valid date');
    }
  }

  return { valid: errors.length === 0, errors };
};

const importRegistry = async (registryData, models, options = {}) => {
  const { dryRun = false, actorName = 'import-cli', fileName = null } = options;
  const { Customer, Plan, License, ImportBatch, AuditLog, sequelize } = models;

  if (!Array.isArray(registryData)) {
    throw new Error('Registry file must be a JSON array');
  }

  if (registryData.length > MAX_ENTRY_LENGTH) {
    throw new Error('Registry file exceeds maximum entry limit (' + MAX_ENTRY_LENGTH + ')');
  }

  const validationErrors = [];
  registryData.forEach((entry, i) => {
    const { valid, errors } = validateEntry(entry, i + 1);
    if (!valid) validationErrors.push(...errors);
  });

  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors,
      totalEntries: registryData.length,
      importedCount: 0,
      skippedCount: 0,
      errorCount: validationErrors.length,
    };
  }

  if (dryRun) {
    let wouldImport = 0;
    let wouldSkip = 0;
    const seenHashes = new Set();
    const details = [];

    for (let i = 0; i < registryData.length; i++) {
      const entry = registryData[i];

      if (seenHashes.has(entry.payloadHash)) {
        wouldSkip++;
        details.push({ index: i + 1, customer: entry.customer, status: 'would_skip', reason: 'duplicate payloadHash (in file)' });
        continue;
      }

      seenHashes.add(entry.payloadHash);

      const existing = await License.findOne({ where: { payloadHash: entry.payloadHash } });
      if (existing) {
        wouldSkip++;
        details.push({ index: i + 1, customer: entry.customer, status: 'would_skip', reason: 'duplicate payloadHash (in DB)' });
      } else {
        wouldImport++;
        details.push({ index: i + 1, customer: entry.customer, status: 'would_import' });
      }
    }

    return {
      success: true,
      dryRun: true,
      totalEntries: registryData.length,
      importedCount: wouldImport,
      skippedCount: wouldSkip,
      errorCount: 0,
      details,
    };
  }

  const transaction = await sequelize.transaction();
  let importedCount = 0;
  let skippedCount = 0;
  const details = [];

  try {
    const batch = await ImportBatch.create({
      fileName,
      totalEntries: registryData.length,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      dryRun: false,
      actorName,
    }, { transaction });

    const seenHashes = new Set();

    for (let i = 0; i < registryData.length; i++) {
      const entry = registryData[i];

      if (seenHashes.has(entry.payloadHash)) {
        skippedCount++;
        details.push({ index: i + 1, customer: entry.customer, status: 'skipped', reason: 'duplicate payloadHash (in file)' });
        continue;
      }

      seenHashes.add(entry.payloadHash);

      const existing = await License.findOne({
        where: { payloadHash: entry.payloadHash },
        transaction,
      });

      if (existing) {
        skippedCount++;
        details.push({ index: i + 1, customer: entry.customer, status: 'skipped', reason: 'duplicate payloadHash (in DB)' });
        continue;
      }

      const [customer] = await Customer.findOrCreate({
        where: { name: entry.customer },
        defaults: { name: entry.customer },
        transaction,
      });

      let plan = null;
      if (entry.plan) {
        plan = await Plan.findOne({ where: { name: entry.plan }, transaction });
      }

      await License.create({
        customerId: customer.id,
        planId: plan ? plan.id : null,
        features: entry.features || [],
        expiresAt: entry.expires ? new Date(entry.expires) : null,
        algorithm: entry.algorithm || 'RSA-SHA256',
        payloadHash: entry.payloadHash,
        licenseHash: entry.licenseHash || null,
        licensePayload: null,
        issuedAt: entry.issuedAt ? new Date(entry.issuedAt) : new Date(),
        actorName: entry.issuedBy || actorName,
        importBatchId: batch.id,
      }, { transaction });

      await AuditLog.create({
        actorName,
        action: 'import_license',
        entityType: 'License',
        details: {
          customer: entry.customer,
          plan: entry.plan || null,
          payloadHash: entry.payloadHash,
          source: 'registry_import',
        },
      }, { transaction });

      importedCount++;
      details.push({ index: i + 1, customer: entry.customer, status: 'imported' });
    }

    await batch.update({
      importedCount,
      skippedCount,
      errorCount: 0,
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      dryRun: false,
      batchId: batch.id,
      totalEntries: registryData.length,
      importedCount,
      skippedCount,
      errorCount: 0,
      details,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { importRegistry, validateEntry };
