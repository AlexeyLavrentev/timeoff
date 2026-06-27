'use strict';

const session = require('express-session');
const { DataTypes } = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

const defineSessionModel = (sequelize) => {
  return sequelize.define('PortalSession', {
    sid: { type: DataTypes.STRING, primaryKey: true },
    expires: { type: DataTypes.DATE, allowNull: true },
    data: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'portal_sessions',
    timestamps: false,
  });
};

const createPersistentStore = (sequelize) => {
  const sessionModel = defineSessionModel(sequelize);

  const store = new SequelizeStore({
    db: sequelize,
    table: 'PortalSession',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: SESSION_MAX_AGE,
  });

  store.sessionModel = sessionModel;

  return store;
};

module.exports = { createPersistentStore, defineSessionModel, SESSION_MAX_AGE };
