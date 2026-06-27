'use strict';

const healthRoute = (models) => async (_req, res) => {
  let dbOk = false;

  try {
    await models.sequelize.authenticate();
    dbOk = true;
  } catch (_error) {
    dbOk = false;
  }

  res.json({
    ok: dbOk,
    service: 'license-portal',
    db: dbOk,
  });
};

module.exports = healthRoute;
