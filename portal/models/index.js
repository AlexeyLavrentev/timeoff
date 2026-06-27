'use strict';

const fs = require('fs');
const path = require('path');
const { createPortalSequelize } = require('../db');

const loadPortalModels = (sequelizeOptions = {}) => {
  const sequelize = sequelizeOptions.sequelize || createPortalSequelize(sequelizeOptions);
  const models = {};
  const modelsDir = __dirname;

  fs.readdirSync(modelsDir)
    .filter(file => file.indexOf('.') !== 0 && file !== 'index.js' && file.endsWith('.js'))
    .forEach(file => {
      const modelFactory = require(path.join(modelsDir, file));
      const model = modelFactory(sequelize);
      models[model.name] = model;
    });

  Object.keys(models).forEach(name => {
    if (typeof models[name].associate === 'function') {
      models[name].associate(models);
    }
  });

  models.sequelize = sequelize;
  models.Sequelize = require('sequelize');

  return models;
};

module.exports = { loadPortalModels };
