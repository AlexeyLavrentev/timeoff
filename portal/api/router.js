'use strict';

const express = require('express');
const { hashPassword, verifyPassword } = require('../auth/passwords');
const { requireAuth, requireRole } = require('../auth/middleware');
const { listCustomers, createCustomer } = require('../services/customer_service');
const { listPlans } = require('../services/plan_service');
const { issueLicense, listLicenses, getLicense, getLicenseBlob } = require('../services/license_service');

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const createAuthRouter = (models) => {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await models.AdminUser.findOne({ where: { email: email.toLowerCase().trim() } });

      if (!user) {
        await models.AuditLog.create({
          action: 'login_failed',
          entityType: 'AdminUser',
          details: { email: email.toLowerCase().trim(), reason: 'invalid_credentials' },
        });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.isActive) {
        await models.AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'account_inactive' },
        });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        await models.AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'account_locked' },
        });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = verifyPassword(password, user.passwordHash);

      if (!valid) {
        const newCount = user.failedLoginCount + 1;
        const updates = { failedLoginCount: newCount };

        if (newCount >= LOCKOUT_THRESHOLD) {
          updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }

        await user.update(updates);

        await models.AuditLog.create({
          actorName: user.email,
          action: 'login_failed',
          entityType: 'AdminUser',
          entityId: user.id,
          details: { reason: 'invalid_credentials' },
        });

        return res.status(401).json({ error: 'Invalid email or password' });
      }

      await user.update({
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      });

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;

      await models.AuditLog.create({
        actorName: user.email,
        action: 'login_success',
        entityType: 'AdminUser',
        entityId: user.id,
        details: { role: user.role },
      });

      res.json({ user: user.toSafeJSON() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const email = req.session ? req.session.userEmail : null;

      if (req.session) {
        await models.AuditLog.create({
          actorName: email,
          action: 'logout',
          entityType: 'AdminUser',
        });

        req.session.destroy(err => {
          if (err) return next(err);
          res.json({ ok: true });
        });
      } else {
        res.json({ ok: true });
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await models.AdminUser.findByPk(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: user.toSafeJSON() });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

const createPortalRouter = (models, signingProvider) => {
  const router = express.Router();

  router.get('/customers', requireAuth, async (_req, res, next) => {
    try {
      const customers = await listCustomers(models.Customer);
      res.json(customers.map(c => c.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.post('/customers', requireRole('admin'), async (req, res, next) => {
    try {
      const customer = await createCustomer(models.Customer, req.body || {});
      res.status(201).json(customer.toJSON());
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'DUPLICATE') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/plans', requireAuth, async (_req, res, next) => {
    try {
      const plans = await listPlans(models.Plan);
      res.json(plans.map(p => p.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.get('/licenses', requireAuth, async (_req, res, next) => {
    try {
      const licenses = await listLicenses(models.License);
      res.json(licenses.map(l => l.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.post('/licenses', requireRole('issuer', 'admin'), async (req, res, next) => {
    try {
      const body = req.body || {};

      if (!body.customerId) {
        return res.status(400).json({ error: 'customerId is required' });
      }

      if (!body.planId) {
        return res.status(400).json({ error: 'planId is required' });
      }

      if (body.features !== undefined && body.features !== null) {
        if (!Array.isArray(body.features)) {
          return res.status(400).json({ error: 'features must be an array' });
        }
        if (body.features.some(f => typeof f !== 'string')) {
          return res.status(400).json({ error: 'features must be an array of strings' });
        }
      }

      if (body.expiresAt) {
        const ts = Date.parse(body.expiresAt);
        if (Number.isNaN(ts)) {
          return res.status(400).json({ error: 'expiresAt is not a valid date' });
        }
        if (ts < Date.now()) {
          return res.status(400).json({ error: 'expiresAt must be in the future' });
        }
      }

      const result = await issueLicense(models, signingProvider, {
        customerId: body.customerId,
        planId: body.planId,
        expiresAt: body.expiresAt || null,
        features: body.features || null,
        actorName: req.session.userEmail,
      });

      res.status(201).json({
        ...result.license,
        licensePayload: undefined,
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'DUPLICATE_LICENSE') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/licenses/:id', requireAuth, async (req, res, next) => {
    try {
      const license = await getLicense(models.License, req.params.id);
      res.json(license.toJSON());
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/licenses/:id/download', requireAuth, async (req, res, next) => {
    try {
      const blob = await getLicenseBlob(models.License, req.params.id);
      const format = req.query.format === 'base64'
        ? Buffer.from(blob, 'utf8').toString('base64')
        : blob;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="license.json"');
      res.send(format);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  });

  return router;
};

module.exports = { createPortalRouter, createAuthRouter };
