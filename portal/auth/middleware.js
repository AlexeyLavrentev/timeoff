'use strict';

const ROLE_HIERARCHY = { admin: 3, issuer: 2, viewer: 1 };

const destroySession = req => new Promise(resolve => {
  if (!req.session) return resolve();
  req.session.destroy(() => resolve());
});

const createPortalAuth = (models, options = {}) => {
  const web = options.kind === 'web';

  const loadSessionUser = async (req, _res, next) => {
    try {
      req.portalUser = null;
      if (!req.session || !req.session.userId) return next();

      const user = await models.AdminUser.findByPk(req.session.userId);
      const revisionMatches = user
        && Number(req.session.authRevision) === Number(user.authRevision);

      if (!user || !user.isActive || !revisionMatches) {
        await destroySession(req);
        return next();
      }

      req.portalUser = user;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;
      next();
    } catch (error) {
      next(error);
    }
  };

  const unauthenticated = (req, res) => web
    ? res.redirect('/login')
    : res.status(401).json({ error: 'Authentication required' });

  const requireAuth = (req, res, next) => {
    if (!req.portalUser) return unauthenticated(req, res);
    next();
  };

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.portalUser) return unauthenticated(req, res);
    if (!roles.includes(req.portalUser.role)) {
      return web
        ? res.status(403).send('Доступ запрещён')
        : res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };

  return { loadSessionUser, requireAuth, requireRole };
};

module.exports = { createPortalAuth, destroySession, ROLE_HIERARCHY };
