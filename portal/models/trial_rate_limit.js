'use strict';

const { DataTypes } = require('sequelize');

module.exports = sequelize => sequelize.define('TrialRateLimit', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
  },
  requestIpHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  windowStartedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'trial_rate_limits',
  timestamps: true,
  indexes: [{ fields: ['windowStartedAt'] }],
});
