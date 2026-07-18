'use strict';

const expect = require('chai').expect;
const moment = require('moment');
const Sequelize = require('sequelize');
const defineUser = require('../../lib/model/db/user');

describe('User active status on employment end date', function() {
  it('keeps the employee active through the stated end date', async function() {
    const originalNow = moment.now;
    const sequelize = new Sequelize('sqlite::memory:', {logging: false});

    try {
      moment.now = function() {
        return Date.parse('2026-07-17T12:00:00Z');
      };
      const User = defineUser(sequelize, Sequelize.DataTypes);
      const employee = User.build({
        email: 'end-date@test.com',
        password: 'hash',
        name: 'End',
        lastname: 'Date',
        end_date: '2026-07-17',
      });

      expect(employee.is_active()).to.equal(true);
    } finally {
      moment.now = originalNow;
      await sequelize.close();
    }
  });
});
