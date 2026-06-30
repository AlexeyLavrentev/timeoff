'use strict';

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const defaultStorage = path.join(__dirname, '..', 'data', 'portal.sqlite');

const createPortalSequelize = (options = {}) => {
  const storage = options.storage || process.env.PORTAL_DB_STORAGE || defaultStorage;
  const logging = options.logging !== undefined ? options.logging : false;

  if (storage !== ':memory:') {
    fs.mkdirSync(path.dirname(storage), { recursive: true });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage,
    logging,
  });
};

module.exports = { createPortalSequelize };
