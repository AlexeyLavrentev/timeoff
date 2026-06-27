'use strict';

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!roles.includes(req.session.userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
};

const ROLE_HIERARCHY = { admin: 3, issuer: 2, viewer: 1 };

const requireAnyRole = (...roles) => (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!roles.includes(req.session.userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
};

module.exports = { requireAuth, requireRole, requireAnyRole, ROLE_HIERARCHY };
