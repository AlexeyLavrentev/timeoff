'use strict';

const express = require('express');
const { listCustomers, createCustomer } = require('../services/customer_service');
const { listPlans } = require('../services/plan_service');
const { issueLicense, listLicenses, getLicense, getLicenseBlob } = require('../services/license_service');

const createPortalRouter = (models, signingProvider) => {
  const router = express.Router();

  router.get('/customers', async (_req, res, next) => {
    try {
      const customers = await listCustomers(models.Customer);
      res.json(customers.map(c => c.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.post('/customers', async (req, res, next) => {
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

  router.get('/plans', async (_req, res, next) => {
    try {
      const plans = await listPlans(models.Plan);
      res.json(plans.map(p => p.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.get('/licenses', async (_req, res, next) => {
    try {
      const licenses = await listLicenses(models.License);
      res.json(licenses.map(l => l.toJSON()));
    } catch (error) {
      next(error);
    }
  });

  router.post('/licenses', async (req, res, next) => {
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
        actorName: 'portal-api',
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

  router.get('/licenses/:id', async (req, res, next) => {
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

  router.get('/licenses/:id/download', async (req, res, next) => {
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

module.exports = { createPortalRouter };
