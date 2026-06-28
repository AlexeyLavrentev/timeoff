'use strict';

const crypto = require('crypto');
const express = require('express');
const { verifyPassword } = require('../auth/passwords');
const { listCustomers, createCustomer } = require('../services/customer_service');
const { listPlans } = require('../services/plan_service');
const { issueLicense, listLicenses, getLicense, getLicenseBlob } = require('../services/license_service');

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const csrfProtect = (req, res, next) => {
  if (req.method === 'GET') return next();

  const token = req.body && req.body._csrf;
  const sessionToken = req.session && req.session.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).send('CSRF token mismatch');
  }

  next();
};

const generateCsrfToken = (req) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(16).toString('hex');
  }
  return req.session.csrfToken;
};

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().split('T')[0];
};

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const SAFE_DETAIL_KEYS = new Set([
  'reason', 'role', 'email', 'customer', 'plan', 'features',
  'expiresAt', 'payloadHash', 'licenseHash', 'count', 'source',
  'displayNamePresent', 'lockoutCleared',
  'seats', 'domainCount', 'externalCustomerIdPresent', 'operatorNotesPresent',
]);

const BLOCKED_KEY_PATTERNS = [
  'password', 'secret', 'token', 'private', 'signature',
  'licensepayload', 'session', 'key',
];

const summarizeAuditDetails = (details) => {
  if (!details || typeof details !== 'object') return '—';

  const parts = [];
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase();

    if (lower === 'payloadhash' || lower === 'licensehash') {
      parts.push(key + '=' + String(value).substring(0, 16) + '…');
      continue;
    }

    if (!SAFE_DETAIL_KEYS.has(key)) continue;

    const blocked = BLOCKED_KEY_PATTERNS.some(p => lower.includes(p));
    if (blocked) continue;

    const str = Array.isArray(value) ? value.join(',') : String(value);
    parts.push(key + '=' + str.substring(0, 40));
  }

  const result = parts.join(', ');
  return result ? result.substring(0, 120) : '—';
};

const createWebRoutes = (models, options = {}) => {
  const router = express.Router();
  const { AdminUser, Customer, Plan, License, AuditLog } = models;

  router.use((req, res, next) => {
    res.locals.user = req.session && req.session.userId
      ? { id: req.session.userId, email: req.session.userEmail, role: req.session.userRole }
      : null;
    res.locals.csrf = generateCsrfToken(req);
    next();
  });

  router.get('/login', (req, res) => {
    if (res.locals.user) return res.redirect('/');
    res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: null });
  });

  router.post('/login', csrfProtect, async (req, res, next) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: 'Email и пароль обязательны' });
      }

      const user = await AdminUser.findOne({ where: { email: email.toLowerCase().trim() } });

      if (!user) {
        await AuditLog.create({
          action: 'login_failed',
          entityType: 'AdminUser',
          details: { email: email.toLowerCase().trim(), reason: 'invalid_credentials' },
        });
        return res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: 'Неверный email или пароль' });
      }

      if (!user.isActive) {
        await AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'account_inactive' },
        });
        return res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: 'Неверный email или пароль' });
      }

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        await AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'account_locked' },
        });
        return res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: 'Неверный email или пароль' });
      }

      const valid = verifyPassword(password, user.passwordHash);

      if (!valid) {
        const newCount = user.failedLoginCount + 1;
        const updates = { failedLoginCount: newCount };
        if (newCount >= LOCKOUT_THRESHOLD) {
          updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }
        await user.update(updates);

        await AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'invalid_credentials' },
        });

        return res.render('login', { title: 'Вход', csrf: res.locals.csrf, error: 'Неверный email или пароль' });
      }

      await user.update({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null });

      const savedEmail = user.email;
      const savedId = user.id;
      const savedRole = user.role;

      req.session.regenerate(async (err) => {
        if (err) return next(err);

        try {
          req.session.userId = savedId;
          req.session.userEmail = savedEmail;
          req.session.userRole = savedRole;
          req.session.csrfToken = crypto.randomBytes(16).toString('hex');

          await AuditLog.create({
            actorName: savedEmail,
            action: 'login_success',
            entityType: 'AdminUser',
            entityId: savedId,
            details: { role: savedRole },
          });

          res.redirect('/');
        } catch (innerError) {
          next(innerError);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', csrfProtect, async (req, res, next) => {
    try {
      if (req.session) {
        await AuditLog.create({
          actorName: req.session.userEmail,
          action: 'logout',
          entityType: 'AdminUser',
        });
        req.session.destroy((destroyErr) => {
          if (destroyErr) return next(destroyErr);
          res.redirect('/login');
        });
      } else {
        res.redirect('/login');
      }
    } catch (error) {
      next(error);
    }
  });

  const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    next();
  };

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    if (!roles.includes(req.session.userRole)) return res.status(403).send('Доступ запрещён');
    next();
  };

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const [customers, plans, licenses, recentLicensesRaw] = await Promise.all([
        Customer.count(),
        Plan.count(),
        License.count(),
        License.findAll({
          attributes: { exclude: ['licensePayload'] },
          order: [['issuedAt', 'DESC']],
          limit: 5,
          include: [
            { model: Customer, as: 'customer', attributes: ['name'] },
            { model: Plan, as: 'plan', attributes: ['name'] },
          ],
        }),
      ]);

      const recentLicenses = recentLicensesRaw.map(l => ({
        id: l.id,
        customerName: l.customer ? escapeHtml(l.customer.name) : '—',
        planName: l.plan ? escapeHtml(l.plan.name) : '—',
        expiresAt: formatDate(l.expiresAt),
        issuedAt: formatDate(l.issuedAt),
      }));

      res.render('dashboard', {
        title: 'Dashboard',
        csrf: res.locals.csrf,
        counts: { customers, plans, licenses },
        recentLicenses,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/customers', requireAuth, async (req, res, next) => {
    try {
      const customers = await listCustomers(Customer);
      res.render('customers', {
        title: 'Клиенты',
        csrf: res.locals.csrf,
        customers: customers.map(c => ({
          ...c.toJSON(),
          name: escapeHtml(c.name),
          contactEmail: escapeHtml(c.contactEmail),
          createdAt: formatDate(c.createdAt),
        })),
        isAdmin: req.session.userRole === 'admin',
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/customers/new', requireRole('admin'), (req, res) => {
    res.render('customer-new', { title: 'Новый клиент', csrf: res.locals.csrf, error: null, values: {} });
  });

  router.post('/customers', requireRole('admin'), csrfProtect, async (req, res, next) => {
    try {
      const customer = await createCustomer(Customer, req.body || {});
      res.redirect('/customers');
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR' || error.code === 'DUPLICATE') {
        return res.render('customer-new', {
          title: 'Новый клиент',
          csrf: res.locals.csrf,
          error: error.message,
          values: req.body || {},
        });
      }
      next(error);
    }
  });

  router.get('/customers/:id', requireAuth, async (req, res, next) => {
    try {
      const customer = await Customer.findByPk(req.params.id);
      if (!customer) return res.status(404).send('Клиент не найден');

      const [totalLicenseCount, licenses] = await Promise.all([
        License.count({ where: { customerId: customer.id } }),
        License.findAll({
          attributes: { exclude: ['licensePayload'] },
          where: { customerId: customer.id },
          order: [['issuedAt', 'DESC']],
          limit: 20,
          include: [
            { model: Plan, as: 'plan', attributes: ['name'] },
          ],
        }),
      ]);

      const now = new Date();
      const filterValue = encodeURIComponent(customer.name);

      res.render('customer-detail', {
        title: escapeHtml(customer.name),
        csrf: res.locals.csrf,
        customer: {
          id: customer.id,
          name: escapeHtml(customer.name),
          contactEmail: escapeHtml(customer.contactEmail),
          contactName: escapeHtml(customer.contactName),
          createdAt: formatDate(customer.createdAt),
          licenseCount: totalLicenseCount,
          latestIssuedAt: licenses.length > 0 ? formatDate(licenses[0].issuedAt) : null,
          filterValue,
        },
        licenses: licenses.map(l => {
          let statusDisplay = '—';
          if (l.expiresAt) {
            statusDisplay = l.expiresAt > now ? 'Активна' : 'Истекла';
          } else {
            statusDisplay = 'Бессрочная';
          }
          return {
            id: l.id,
            planName: l.plan ? escapeHtml(l.plan.name) : '—',
            featuresShort: (l.features || []).slice(0, 3).join(', ') + (l.features && l.features.length > 3 ? '…' : ''),
            expiresAtDisplay: formatDate(l.expiresAt),
            statusDisplay,
            issuedAtDisplay: formatDate(l.issuedAt),
            actorName: escapeHtml(l.actorName) || '—',
            payloadHashShort: l.payloadHash ? l.payloadHash.substring(0, 12) + '…' : '—',
            licenseHashShort: l.licenseHash ? l.licenseHash.substring(0, 12) + '…' : '—',
          };
        }),
        canIssue: ['issuer', 'admin'].includes(req.session.userRole),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/plans', requireAuth, async (req, res, next) => {
    try {
      const plans = await listPlans(Plan);
      res.render('plans', {
        title: 'Планы',
        csrf: res.locals.csrf,
        plans: plans.map(p => ({
          ...p.toJSON(),
          name: escapeHtml(p.name),
          description: escapeHtml(p.description),
          featuresList: (p.features || []).join(', '),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/licenses', requireAuth, async (req, res, next) => {
    try {
      const { Op } = models.Sequelize;
      const where = {};
      const customerWhere = {};
      const planWhere = {};

      const singleValue = (v) => {
        if (Array.isArray(v)) return (v[0] || '').trim().substring(0, 128);
        return typeof v === 'string' ? v.trim().substring(0, 128) : '';
      };

      const sanitizeLike = (v) => v.replace(/[%_]/g, '');

      const customerFilter = singleValue(req.query.customer);
      const planFilter = singleValue(req.query.plan);
      const qFilter = singleValue(req.query.q);
      const externalIdFilter = singleValue(req.query.externalCustomerId);
      const domainFilter = singleValue(req.query.domain);
      const minSeatsRaw = singleValue(req.query.minSeats);
      const maxSeatsRaw = singleValue(req.query.maxSeats);

      const VALID_STATUSES = ['all', 'active', 'expired'];
      const rawStatus = singleValue(req.query.status);
      const statusFilter = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'all';

      const minSeats = /^\d+$/.test(minSeatsRaw) ? Number(minSeatsRaw) : null;
      const maxSeats = /^\d+$/.test(maxSeatsRaw) ? Number(maxSeatsRaw) : null;

      const customerLike = sanitizeLike(customerFilter);
      const qLike = sanitizeLike(qFilter);

      const sanitizeDomain = (v) => {
        const d = String(v || '').trim().toLowerCase();
        if (!d || d.length > 253 || d.includes('://') || d.includes('/') || d.includes('@') || d.includes('*') || d.includes(' ')) return null;
        return d;
      };
      const domainLike = sanitizeDomain(domainFilter);

      if (customerFilter && customerLike) {
        customerWhere.name = { [Op.like]: '%' + customerLike + '%' };
      } else if (customerFilter && !customerLike) {
        customerWhere.id = { [Op.in]: [] };
      }

      if (planFilter) {
        planWhere.name = planFilter;
      }

      if (statusFilter === 'active') {
        where[Op.or] = [
          { expiresAt: { [Op.is]: null } },
          { expiresAt: { [Op.gte]: new Date() } },
        ];
      } else if (statusFilter === 'expired') {
        where.expiresAt = { [Op.lt]: new Date() };
      }

      if (qFilter && qLike) {
        const qConditions = [
          { payloadHash: { [Op.like]: qLike + '%' } },
          { licenseHash: { [Op.like]: qLike + '%' } },
          { '$customer.name$': { [Op.like]: '%' + qLike + '%' } },
          { '$plan.name$': { [Op.like]: '%' + qLike + '%' } },
        ];

        if (where[Op.or]) {
          where[Op.and] = [
            { [Op.or]: where[Op.or] },
            { [Op.or]: qConditions },
          ];
          delete where[Op.or];
        } else {
          where[Op.or] = qConditions;
        }
      } else if (qFilter && !qLike) {
        where.id = { [Op.in]: [] };
      }

      const domainFilterProvided = !!singleValue(req.query.domain);
      const needsMetadataFilter = externalIdFilter || domainFilterProvided || minSeats || maxSeats;
      const hasInvalidDomain = domainFilterProvided && !domainLike;

      const allPlans = await listPlans(Plan);

      let licenses = await License.findAll({
        attributes: { exclude: ['licensePayload'] },
        where,
        order: [['issuedAt', 'DESC']],
        limit: 200,
        include: [
          { model: Customer, as: 'customer', attributes: ['name'], where: Object.keys(customerWhere).length ? customerWhere : undefined },
          { model: Plan, as: 'plan', attributes: ['name'], where: Object.keys(planWhere).length ? planWhere : undefined },
        ],
      });

      if (hasInvalidDomain) {
        licenses = [];
      } else if (needsMetadataFilter) {
        licenses = licenses.filter(l => {
          const m = l.metadata || {};

          if (externalIdFilter) {
            const eid = String(m.externalCustomerId || '').toLowerCase();
            if (!eid.includes(externalIdFilter.toLowerCase())) return false;
          }

          if (domainLike) {
            const domains = m.customerDomains || [];
            if (!domains.some(d => d === domainLike)) return false;
          }

          if (minSeats) {
            if (!m.seats || m.seats < minSeats) return false;
          }

          if (maxSeats) {
            if (!m.seats || m.seats > maxSeats) return false;
          }

          return true;
        });
      }

      licenses = licenses.slice(0, 100);

      res.render('licenses', {
        title: 'Лицензии',
        csrf: res.locals.csrf,
        licenses: licenses.map(l => ({
          id: l.id,
          customerName: l.customer ? escapeHtml(l.customer.name) : '—',
          planName: l.plan ? escapeHtml(l.plan.name) : '—',
          featuresShort: (l.features || []).slice(0, 3).join(', ') + (l.features && l.features.length > 3 ? '…' : ''),
          expiresAtDisplay: formatDate(l.expiresAt),
          issuedAtDisplay: formatDate(l.issuedAt),
        })),
        canIssue: ['issuer', 'admin'].includes(req.session.userRole),
        filters: {
          customer: escapeHtml(customerFilter),
          plan: escapeHtml(planFilter),
          status: statusFilter,
          q: escapeHtml(qFilter),
          externalCustomerId: escapeHtml(externalIdFilter),
          domain: escapeHtml(domainFilter),
          minSeats: minSeatsRaw,
          maxSeats: maxSeatsRaw,
        },
        plans: allPlans.map(p => ({ name: escapeHtml(p.name) })),
        hasActiveFilters: !!(customerFilter || planFilter || statusFilter !== 'all' || qFilter),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/licenses/new', requireRole('issuer', 'admin'), async (req, res, next) => {
    try {
      const [customers, plans] = await Promise.all([
        listCustomers(Customer),
        listPlans(Plan),
      ]);
      res.render('license-new', {
        title: 'Выпустить лицензию',
        csrf: res.locals.csrf,
        error: null,
        values: {},
        customers: customers.map(c => ({ id: c.id, name: escapeHtml(c.name) })),
        plans: plans.map(p => ({ id: p.id, name: escapeHtml(p.name) })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/licenses', requireRole('issuer', 'admin'), csrfProtect, async (req, res, next) => {
    try {
      const { validateMetadata } = require('../services/license_metadata');
      const body = req.body || {};
      const features = body.features && body.features.trim()
        ? body.features.split('\n').map(f => f.trim()).filter(Boolean)
        : null;

      const { metadata, errors: metaErrors } = validateMetadata(body);
      if (metaErrors.length > 0) {
        const [customers, plans] = await Promise.all([
          listCustomers(Customer),
          listPlans(Plan),
        ]);
        return res.render('license-new', {
          title: 'Выпустить лицензию',
          csrf: res.locals.csrf,
          error: metaErrors.join('; '),
          values: body,
          customers: customers.map(c => ({ id: c.id, name: escapeHtml(c.name) })),
          plans: plans.map(p => ({ id: p.id, name: escapeHtml(p.name) })),
        });
      }

      await issueLicense(models, options.signingProvider, {
        customerId: body.customerId,
        planId: body.planId,
        expiresAt: body.expiresAt || null,
        features,
        actorName: req.session.userEmail,
        metadata,
      });

      res.redirect('/licenses');
    } catch (error) {
      if (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR' || error.code === 'DUPLICATE_LICENSE') {
        const [customers, plans] = await Promise.all([
          listCustomers(Customer),
          listPlans(Plan),
        ]);
        return res.render('license-new', {
          title: 'Выпустить лицензию',
          csrf: res.locals.csrf,
          error: error.message,
          values: req.body || {},
          customers: customers.map(c => ({ id: c.id, name: escapeHtml(c.name) })),
          plans: plans.map(p => ({ id: p.id, name: escapeHtml(p.name) })),
        });
      }
      next(error);
    }
  });

  router.get('/licenses/:id', requireAuth, async (req, res, next) => {
    try {
      const license = await License.findByPk(req.params.id, {
        attributes: { exclude: ['licensePayload'] },
        include: [
          { model: Customer, as: 'customer', attributes: ['name'] },
          { model: Plan, as: 'plan', attributes: ['name'] },
        ],
      });

      if (!license) return res.status(404).send('Лицензия не найдена');

      const m = license.metadata || {};

      res.render('license-detail', {
        title: 'Лицензия',
        csrf: res.locals.csrf,
        license: {
          id: license.id,
          customerName: license.customer ? escapeHtml(license.customer.name) : '—',
          planName: license.plan ? escapeHtml(license.plan.name) : '—',
          featuresList: (license.features || []).join(', '),
          expiresAtDisplay: formatDate(license.expiresAt),
          algorithm: license.algorithm,
          issuedAtDisplay: formatDate(license.issuedAt),
          actorName: escapeHtml(license.actorName),
          payloadHash: license.payloadHash,
          licenseHash: license.licenseHash,
          seats: m.seats || null,
          customerDomainsList: m.customerDomains ? m.customerDomains.join(', ') : null,
          externalCustomerId: escapeHtml(m.externalCustomerId) || null,
          operatorNotes: escapeHtml(m.operatorNotes) || null,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/licenses/:id/download', requireAuth, async (req, res, next) => {
    try {
      const blob = await getLicenseBlob(License, req.params.id);

      await AuditLog.create({
        actorName: req.session.userEmail,
        action: 'license_download',
        entityType: 'License',
        entityId: req.params.id,
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="license.json"');
      res.send(blob);
    } catch (error) {
      if (error.code === 'NOT_FOUND') return res.status(404).send('Лицензия не найдена');
      next(error);
    }
  });

  router.get('/licenses/export/registry.json', requireRole('admin'), async (req, res, next) => {
    try {
      const licenses = await License.findAll({
        attributes: { exclude: ['licensePayload'] },
        order: [['issuedAt', 'DESC']],
        include: [
          { model: Customer, as: 'customer', attributes: ['name'] },
          { model: Plan, as: 'plan', attributes: ['name'] },
        ],
      });

      const registry = licenses.map(l => {
        const m = l.metadata || {};
        const entry = {
          customer: l.customer ? l.customer.name : null,
          plan: l.plan ? l.plan.name : null,
          features: l.features || [],
          expires: l.expiresAt ? l.expiresAt.toISOString().split('T')[0] : null,
          algorithm: l.algorithm,
          issuedAt: l.issuedAt ? l.issuedAt.toISOString() : null,
          issuedBy: l.actorName || null,
          payloadHash: l.payloadHash,
          licenseHash: l.licenseHash,
        };
        if (m.seats) entry.seats = m.seats;
        if (m.customerDomains) entry.customerDomains = m.customerDomains;
        if (m.externalCustomerId) entry.externalCustomerId = m.externalCustomerId;
        return entry;
      });

      await AuditLog.create({
        actorName: req.session.userEmail,
        action: 'registry_export',
        entityType: 'License',
        details: { count: registry.length },
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="registry.json"');
      res.json(registry);
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit', requireRole('admin'), async (req, res, next) => {
    try {
      const logs = await AuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      res.render('audit', {
        title: 'Аудит-лог',
        csrf: res.locals.csrf,
        logs: logs.map(l => ({
          id: l.id,
          timestamp: l.createdAt ? new Date(l.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '—',
          actorName: escapeHtml(l.actorName) || '—',
          action: escapeHtml(l.action),
          entityType: escapeHtml(l.entityType),
          entityId: l.entityId ? l.entityId.substring(0, 8) + '…' : '—',
          detailsSummary: escapeHtml(summarizeAuditDetails(l.details)),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { createWebRoutes };
