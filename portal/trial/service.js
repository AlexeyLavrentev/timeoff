'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { issueLicense } = require('../services/license_service');

const TRIAL_DAYS = 30;
const TRIAL_SEATS = 25;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUESTS_PER_IP_PER_HOUR = 5;
const RESEND_AFTER_MS = 2 * 60 * 1000;

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const normalizeEmail = value => String(value || '').trim().toLowerCase();

const validateRequest = input => {
  const email = normalizeEmail(input.email);
  const organizationName = String(input.organizationName || '').trim();
  const contactName = String(input.contactName || '').trim();
  const errors = [];

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Укажите корректный рабочий email');
  }
  if (organizationName.length < 2 || organizationName.length > 120) {
    errors.push('Название организации должно содержать от 2 до 120 символов');
  }
  if (contactName.length > 120) {
    errors.push('Имя контактного лица не должно превышать 120 символов');
  }

  return {
    valid: errors.length === 0,
    errors,
    value: { email, organizationName, contactName: contactName || null },
  };
};

const hashIp = (ip, secret) => crypto
  .createHmac('sha256', secret)
  .update(String(ip || 'unknown'))
  .digest('hex');

const consumeRateLimit = async (models, ipHash, now) => {
  const { TrialRateLimit, Sequelize } = models;
  const windowStartedAt = new Date(Math.floor(now.getTime() / 3600000) * 3600000);
  const bucketId = sha256(`${ipHash}:${windowStartedAt.toISOString()}`);

  await TrialRateLimit.findOrCreate({
    where: { id: bucketId },
    defaults: { id: bucketId, requestIpHash: ipHash, windowStartedAt, attempts: 0 },
  });

  const [affected] = await TrialRateLimit.update(
    { attempts: Sequelize.literal('attempts + 1') },
    { where: { id: bucketId, attempts: { [Op.lt]: REQUESTS_PER_IP_PER_HOUR } } }
  );
  if (affected !== 1) {
    throw Object.assign(new Error('Слишком много запросов. Повторите позднее.'), { code: 'RATE_LIMITED' });
  }

  await TrialRateLimit.destroy({
    where: { windowStartedAt: { [Op.lt]: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
  });
};

const verificationUrl = (baseUrl, token) => {
  const url = new URL('/trial/verify', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
};

const requestTrial = async (models, mailer, config, input, requestContext = {}) => {
  const validation = validateRequest(input);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors.join('. ')), {
      code: 'VALIDATION_ERROR',
      errors: validation.errors,
    });
  }

  const { TrialRequest, AuditLog } = models;
  const now = new Date();
  const ipHash = hashIp(requestContext.ip, config.trialIpHashSecret);
  await consumeRateLimit(models, ipHash, now);

  const existing = await TrialRequest.findOne({
    where: { normalizedEmail: validation.value.email },
  });

  if (existing && ['issued', 'verifying'].includes(existing.status)) {
    return { accepted: true, delivered: false };
  }
  if (existing && existing.status === 'pending'
      && new Date(existing.tokenExpiresAt).getTime() > now.getTime()) {
    return { accepted: true, delivered: false };
  }
  if (existing && existing.status === 'delivery_failed'
      && now.getTime() - new Date(existing.updatedAt).getTime() < RESEND_AFTER_MS) {
    return { accepted: true, delivered: false };
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const values = {
    normalizedEmail: validation.value.email,
    organizationName: validation.value.organizationName,
    contactName: validation.value.contactName,
    tokenHash: sha256(token),
    tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    requestIpHash: ipHash,
    status: 'pending',
  };

  const trialRequest = existing
    ? await existing.update(values)
    : await TrialRequest.create(values);

  try {
    await mailer.sendVerification({
      email: validation.value.email,
      verificationUrl: verificationUrl(config.trialBaseUrl, token),
    });
  } catch (error) {
    await trialRequest.update({ status: 'delivery_failed' });
    await AuditLog.create({
      action: 'trial_delivery_failed',
      entityType: 'TrialRequest',
      entityId: trialRequest.id,
      details: { reason: 'email_delivery_failed' },
    });
    throw Object.assign(new Error('Не удалось отправить письмо. Повторите позднее.'), {
      code: 'DELIVERY_FAILED',
      cause: error,
    });
  }

  await AuditLog.create({
    actorName: 'self-service-trial',
    action: 'trial_requested',
    entityType: 'TrialRequest',
    entityId: trialRequest.id,
    details: { email: validation.value.email, source: 'public-portal' },
  });

  return { accepted: true, delivered: true };
};

const uniqueCustomerName = async (Customer, organizationName, email) => {
  const existingName = await Customer.findOne({ where: { name: organizationName } });
  if (!existingName || normalizeEmail(existingName.contactEmail) === email) return organizationName;
  const suffix = sha256(email).substring(0, 8);
  return `${organizationName.substring(0, 108)} (${suffix})`;
};

const inspectTrialToken = async (models, rawToken) => {
  const token = String(rawToken || '');
  if (token.length < 32 || token.length > 128) {
    throw Object.assign(new Error('Ссылка подтверждения недействительна'), { code: 'INVALID_TOKEN' });
  }

  const request = await models.TrialRequest.findOne({ where: { tokenHash: sha256(token) } });
  if (!request || request.status !== 'pending') {
    throw Object.assign(new Error('Ссылка подтверждения недействительна или уже использована'), { code: 'INVALID_TOKEN' });
  }
  if (new Date(request.tokenExpiresAt).getTime() <= Date.now()) {
    await request.update({ status: 'expired' });
    throw Object.assign(new Error('Ссылка подтверждения истекла. Запросите Trial повторно.'), { code: 'TOKEN_EXPIRED' });
  }

  return request;
};

const redeemTrialRequest = async (models, signingProvider, requestId) => {
  const { TrialRequest, Customer, Plan, AuditLog } = models;
  const request = await TrialRequest.findByPk(requestId);
  if (!request || request.status !== 'pending') {
    throw Object.assign(new Error('Запрос Trial недействителен или уже использован'), { code: 'INVALID_TOKEN' });
  }
  if (new Date(request.tokenExpiresAt).getTime() <= Date.now()) {
    await request.update({ status: 'expired' });
    throw Object.assign(new Error('Ссылка подтверждения истекла. Запросите Trial повторно.'), { code: 'TOKEN_EXPIRED' });
  }

  const [claimed] = await TrialRequest.update(
    { status: 'verifying' },
    { where: { id: request.id, status: 'pending' } }
  );
  if (claimed !== 1) {
    throw Object.assign(new Error('Ссылка подтверждения уже используется'), { code: 'INVALID_TOKEN' });
  }

  let licenseIssued = false;
  try {
    let customer = await Customer.findOne({ where: { contactEmail: request.normalizedEmail } });
    if (!customer) {
      customer = await Customer.create({
        name: await uniqueCustomerName(Customer, request.organizationName, request.normalizedEmail),
        contactEmail: request.normalizedEmail,
        contactName: request.contactName,
        notes: 'Создан автоматически через 30-дневный Trial',
      });
    }

    const plan = await Plan.findOne({ where: { name: 'enterprise' } });
    if (!plan) throw new Error('Enterprise plan is not configured');

    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const issued = await issueLicense(models, signingProvider, {
      customerId: customer.id,
      planId: plan.id,
      expiresAt: expiresAt.toISOString(),
      actorName: 'self-service-trial',
      metadata: {
        seats: TRIAL_SEATS,
        issueReason: 'trial',
        externalCustomerId: `trial:${request.id}`,
      },
    });
    licenseIssued = true;

    await request.update({
      status: 'issued',
      verifiedAt: new Date(),
      customerId: customer.id,
      licenseId: issued.license.id,
    });
    await AuditLog.create({
      actorName: request.normalizedEmail,
      action: 'trial_verified',
      entityType: 'TrialRequest',
      entityId: request.id,
      details: { issueReason: 'trial' },
    });

    return { request, customer, license: issued.license, envelope: issued.envelope, expiresAt };
  } catch (error) {
    if (!licenseIssued) await request.update({ status: 'pending' });
    throw error;
  }
};

module.exports = {
  REQUESTS_PER_IP_PER_HOUR,
  TOKEN_TTL_MS,
  TRIAL_DAYS,
  TRIAL_SEATS,
  normalizeEmail,
  inspectTrialToken,
  redeemTrialRequest,
  requestTrial,
  validateRequest,
  consumeRateLimit,
};
