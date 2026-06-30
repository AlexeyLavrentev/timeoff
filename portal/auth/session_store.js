'use strict';

const session = require('express-session');
const { DataTypes } = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const SESSION_MODEL_NAME = 'PortalSession';

const createPersistentStore = (sequelize) => {
  if (!sequelize.models[SESSION_MODEL_NAME]) {
    sequelize.define(SESSION_MODEL_NAME, {
      sid: { type: DataTypes.STRING, primaryKey: true },
      expires: { type: DataTypes.DATE, allowNull: true },
      data: { type: DataTypes.TEXT, allowNull: true },
    }, {
      tableName: 'portal_sessions',
      timestamps: false,
    });
  }

  const store = new SequelizeStore({
    db: sequelize,
    table: SESSION_MODEL_NAME,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: SESSION_MAX_AGE,
  });

  return store;
};

module.exports = { createPersistentStore, SESSION_MAX_AGE };
