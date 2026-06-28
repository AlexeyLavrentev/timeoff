'use strict';

const crypto = require('crypto');

const canonicalize = value => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const canonicalJson = value => JSON.stringify(canonicalize(value));
const sha256hex = data => crypto.createHash('sha256').update(data).digest('hex');

const issueLicense = async (models, signingProvider, options) => {
  const { Customer, Plan, License, AuditLog, sequelize } = models;
  const { customerId, planId, expiresAt, features: featuresOverride, actorName = 'portal-api', metadata } = options;

  if (featuresOverride !== null && featuresOverride !== undefined) {
    if (!Array.isArray(featuresOverride)) {
      throw Object.assign(new Error('features must be an array'), { code: 'VALIDATION_ERROR' });
    }
    if (featuresOverride.some(f => typeof f !== 'string')) {
      throw Object.assign(new Error('features must be an array of strings'), { code: 'VALIDATION_ERROR' });
    }
  }

  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'NOT_FOUND' });
  }

  let plan = null;
  if (planId) {
    plan = await Plan.findByPk(planId);
    if (!plan) {
      throw Object.assign(new Error('Plan not found'), { code: 'NOT_FOUND' });
    }
  }

  if (expiresAt !== null && expiresAt !== undefined) {
    const ts = Date.parse(expiresAt);
    if (Number.isNaN(ts)) {
      throw Object.assign(new Error('expiresAt is not a valid date'), { code: 'VALIDATION_ERROR' });
    }
    if (ts < Date.now()) {
      throw Object.assign(new Error('expiresAt must be in the future'), { code: 'VALIDATION_ERROR' });
    }
  }

  const features = featuresOverride || (plan ? plan.features : []);

  const payload = {
    customer: customer.name,
    features,
  };

  if (plan) {
    payload.plan = plan.name;
  }

  if (expiresAt) {
    payload.expires = expiresAt;
  }

  const envelope = await signingProvider.sign(payload);
  const payloadHash = sha256hex(canonicalJson(payload));
  const licenseHash = sha256hex(JSON.stringify(envelope));

  const transaction = await sequelize.transaction();

  try {
    const license = await License.create({
      customerId: customer.id,
      planId: plan ? plan.id : null,
      features,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      algorithm: envelope.algorithm,
      payloadHash,
      licenseHash,
      licensePayload: JSON.stringify(envelope),
      issuedAt: new Date(),
      actorName,
      metadata: metadata || null,
    }, { transaction });

    const auditMeta = {};
    if (metadata) {
      if (metadata.seats !== undefined) auditMeta.seats = metadata.seats;
      if (metadata.customerDomains) auditMeta.domainCount = metadata.customerDomains.length;
      if (metadata.externalCustomerId) auditMeta.externalCustomerIdPresent = true;
      if (metadata.operatorNotes) auditMeta.operatorNotesPresent = true;
      if (metadata.issueReason) auditMeta.issueReason = metadata.issueReason;
      if (metadata.replacementOfLicenseId) auditMeta.replacementOfLicenseIdPresent = true;
      if (metadata.lifecycleNote) auditMeta.lifecycleNotePresent = true;
    }

    await AuditLog.create({
      actorName,
      action: 'issue_license',
      entityType: 'License',
      entityId: license.id,
      details: {
        customer: customer.name,
        plan: plan ? plan.name : null,
        features,
        expiresAt: expiresAt || null,
        payloadHash,
        ...auditMeta,
      },
    }, { transaction });

    await transaction.commit();

    return {
      license: {
        id: license.id,
        customerId: license.customerId,
        planId: license.planId,
        features: license.features,
        expiresAt: license.expiresAt,
        algorithm: license.algorithm,
        payloadHash: license.payloadHash,
        licenseHash: license.licenseHash,
        issuedAt: license.issuedAt,
        actorName: license.actorName,
      },
      envelope,
    };
  } catch (error) {
    await transaction.rollback();

    if (error.name === 'SequelizeUniqueConstraintError') {
      throw Object.assign(new Error('License with this payload already exists'), { code: 'DUPLICATE_LICENSE' });
    }

    throw error;
  }
};

const listLicenses = async (License) => {
  return License.findAll({
    attributes: { exclude: ['licensePayload'] },
    order: [['issuedAt', 'DESC']],
  });
};

const getLicense = async (License, id) => {
  const license = await License.findByPk(id, {
    attributes: { exclude: ['licensePayload'] },
  });
  if (!license) {
    throw Object.assign(new Error('License not found'), { code: 'NOT_FOUND' });
  }
  return license;
};

const getLicenseBlob = async (License, id) => {
  const license = await License.findByPk(id);
  if (!license) {
    throw Object.assign(new Error('License not found'), { code: 'NOT_FOUND' });
  }
  if (!license.licensePayload) {
    throw Object.assign(new Error('License blob not available'), { code: 'NOT_FOUND' });
  }
  return license.licensePayload;
};

module.exports = { issueLicense, listLicenses, getLicense, getLicenseBlob };
