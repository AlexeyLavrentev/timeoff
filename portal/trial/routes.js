'use strict';

const crypto = require('crypto');
const express = require('express');
const { getLicenseBlob } = require('../services/license_service');
const { inspectTrialToken, redeemTrialRequest, requestTrial, TRIAL_DAYS, TRIAL_SEATS } = require('./service');

const csrfToken = req => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(16).toString('hex');
  return req.session.csrfToken;
};

const csrfProtect = (req, res, next) => {
  const submitted = String(req.body && req.body._csrf || '');
  const expected = String(req.session && req.session.csrfToken || '');
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);
  if (!submitted || !expected || submittedBuffer.length !== expectedBuffer.length) {
    return res.status(403).send('CSRF token mismatch');
  }
  if (!crypto.timingSafeEqual(submittedBuffer, expectedBuffer)) {
    return res.status(403).send('CSRF token mismatch');
  }
  next();
};

const createTrialRoutes = (models, options) => {
  const router = express.Router();
  const { signingProvider, mailer, config } = options;

  router.use((req, res, next) => {
    res.locals.user = null;
    res.locals.trialEnabled = true;
    res.locals.csrf = csrfToken(req);
    next();
  });

  router.get('/', (req, res) => {
    res.render('trial-request', {
      title: '30-дневный Trial',
      csrf: res.locals.csrf,
      trialDays: TRIAL_DAYS,
      trialSeats: TRIAL_SEATS,
    });
  });

  router.post('/', csrfProtect, async (req, res) => {
    const form = {
      email: String(req.body.email || '').trim(),
      organizationName: String(req.body.organizationName || '').trim(),
      contactName: String(req.body.contactName || '').trim(),
    };

    if (String(req.body.website || '').trim()) {
      return res.render('trial-requested', { title: 'Проверьте почту' });
    }

    try {
      await requestTrial(models, mailer, config, form, { ip: req.ip });
      return res.render('trial-requested', { title: 'Проверьте почту' });
    } catch (error) {
      const known = ['VALIDATION_ERROR', 'RATE_LIMITED', 'DELIVERY_FAILED'].includes(error.code);
      const status = error.code === 'RATE_LIMITED' ? 429 : (known ? 400 : 503);
      return res.status(status).render('trial-request', {
        title: '30-дневный Trial',
        csrf: res.locals.csrf,
        trialDays: TRIAL_DAYS,
        trialSeats: TRIAL_SEATS,
        error: known ? error.message : 'Сервис временно недоступен. Повторите позднее.',
        form,
      });
    }
  });

  router.get('/verify', async (req, res) => {
    try {
      const trialRequest = await inspectTrialToken(models, req.query.token);
      req.session.pendingTrialRequestId = trialRequest.id;
      return res.redirect('/trial/confirm');
    } catch (error) {
      return res.status(400).render('trial-error', {
        title: 'Не удалось активировать Trial',
        error: error.code ? error.message : 'Временная ошибка выпуска лицензии. Повторите позднее.',
      });
    }
  });

  router.get('/confirm', (req, res) => {
    if (!req.session || !req.session.pendingTrialRequestId) return res.redirect('/trial');
    res.render('trial-confirm', {
      title: 'Подтвердите Trial',
      csrf: res.locals.csrf,
      trialDays: TRIAL_DAYS,
      trialSeats: TRIAL_SEATS,
    });
  });

  router.post('/confirm', csrfProtect, async (req, res) => {
    const requestId = req.session && req.session.pendingTrialRequestId;
    if (!requestId) return res.redirect('/trial');

    try {
      const issued = await redeemTrialRequest(models, signingProvider, requestId);
      delete req.session.pendingTrialRequestId;
      req.session.trialLicenseId = issued.license.id;
      req.session.trialRequestId = issued.request.id;
      return res.redirect('/trial/success');
    } catch (error) {
      delete req.session.pendingTrialRequestId;
      return res.status(400).render('trial-error', {
        title: 'Не удалось активировать Trial',
        error: error.code ? error.message : 'Временная ошибка выпуска лицензии. Повторите позднее.',
      });
    }
  });

  router.get('/success', async (req, res, next) => {
    try {
      const requestId = req.session && req.session.trialRequestId;
      const licenseId = req.session && req.session.trialLicenseId;
      if (!requestId || !licenseId) return res.redirect('/trial');

      const trialRequest = await models.TrialRequest.findOne({
        where: { id: requestId, licenseId, status: 'issued' },
      });
      if (!trialRequest) return res.redirect('/trial');

      res.render('trial-success', {
        title: 'Trial готов',
        trialDays: TRIAL_DAYS,
        trialSeats: TRIAL_SEATS,
        expiresAt: new Date(trialRequest.verifiedAt.getTime() + TRIAL_DAYS * 86400000)
          .toISOString().substring(0, 10),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/license', async (req, res, next) => {
    try {
      const requestId = req.session && req.session.trialRequestId;
      const licenseId = req.session && req.session.trialLicenseId;
      const trialRequest = requestId && licenseId && await models.TrialRequest.findOne({
        where: { id: requestId, licenseId, status: 'issued' },
      });
      if (!trialRequest) return res.status(403).send('Trial session is required');

      const blob = await getLicenseBlob(models.License, licenseId);
      await models.AuditLog.create({
        actorName: trialRequest.normalizedEmail,
        action: 'trial_license_download',
        entityType: 'License',
        entityId: licenseId,
        details: { source: 'public-portal' },
      });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leavepilot-trial-license.json"');
      res.send(blob);
    } catch (error) {
      next(error);
    }
  });

  router.get('/public-key', async (req, res, next) => {
    try {
      if (!req.session || !req.session.trialLicenseId) {
        return res.status(403).send('Trial session is required');
      }
      const publicKey = await signingProvider.getPublicKeyPem();
      res.setHeader('Content-Type', 'application/x-pem-file; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leavepilot-license-public.pem"');
      res.send(publicKey);
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { createTrialRoutes, csrfProtect };
