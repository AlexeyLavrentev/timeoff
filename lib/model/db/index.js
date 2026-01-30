"use strict";

var fs        = require("fs");
var path      = require("path");
var Sequelize = require("sequelize");
var env       = process.env.NODE_ENV || "development";
var baseConfig = require(__dirname + '/../../../config/db.json')[env] || {};
var config = Object.assign({}, baseConfig);

if (process.env.DB_DIALECT) {
  config.dialect = process.env.DB_DIALECT;
}
if (process.env.DB_HOST) {
  config.host = process.env.DB_HOST;
}
if (process.env.DB_PORT) {
  config.port = process.env.DB_PORT;
}
if (process.env.DB_STORAGE) {
  config.storage = process.env.DB_STORAGE;
}
if (process.env.DB_LOGGING) {
  config.logging = process.env.DB_LOGGING === 'true';
}

var database = process.env.DB_NAME || process.env.MYSQL_DATABASE || config.database;
var username = process.env.DB_USER || process.env.MYSQL_USER || config.username;
var password = Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD')
  ? process.env.DB_PASSWORD
  : (Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_PASSWORD')
    ? process.env.MYSQL_PASSWORD
    : config.password);

config.database = database;
config.username = username;
config.password = password;

var sequelize = new Sequelize(database, username, password, config);
var db        = {};

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf(".") !== 0)
      && (file !== "index.js");
  })
  .forEach(function(file) {
    var model = sequelize["import"](path.join(__dirname, file));
    db[model.name] = model;
  });

// Link models according associations
//
Object.keys(db).forEach(function(modelName) {
  if ("associate" in db[modelName]) {
    db[modelName].associate(db);
  }
});

// Add scopes
//
Object.keys(db).forEach(function(modelName) {
  if ('loadScope' in db[modelName]) {
    db[modelName].loadScope(db);
  }
});

// Link models based on associations that are based on scopes
//
Object.keys(db).forEach(function(modelName) {
  if ('scopeAssociate' in db[modelName]) {
    db[modelName].scopeAssociate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

const ensureGroupCriticalOverlapColumn = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Groups')) {
      return;
    }

    const attributes = await queryInterface.describeTable('Groups');
    if (!attributes.hasOwnProperty('max_critical_overlap')) {
      await queryInterface.addColumn(
        'Groups',
        'max_critical_overlap',
        db.Group.attributes.max_critical_overlap
      );
    }
    if (!attributes.hasOwnProperty('is_hr_group')) {
      await queryInterface.addColumn(
        'Groups',
        'is_hr_group',
        db.Group.attributes.is_hr_group
      );
    }

    if (!tables.includes('UserGroups')) {
      return;
    }

    const userGroupAttributes = await queryInterface.describeTable('UserGroups');
    if (!userGroupAttributes.hasOwnProperty('is_critical')) {
      await queryInterface.addColumn(
        'UserGroups',
        'is_critical',
        db.UserGroup.attributes.is_critical
      );
    }
  } catch (error) {
    console.warn(`Failed to ensure group schema updates: ${error}`);
  }
};

db.ready = ensureGroupCriticalOverlapColumn();

module.exports = db;
