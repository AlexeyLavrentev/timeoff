'use strict';

const expect = require('chai').expect;
const Sequelize = require('sequelize');
const seatLimit = require('../../lib/licensing/seat_limit');
const defineUser = require('../../lib/model/db/user');

describe('License active-user seat limit', function() {
  const originalEnv = {};
  const envKeys = ['NODE_ENV', 'TIMEOFF_LICENSE'];

  beforeEach(function() {
    envKeys.forEach(function(key) {
      originalEnv[key] = process.env[key];
    });
    process.env.NODE_ENV = 'test';
    process.env.TIMEOFF_LICENSE = JSON.stringify({maxActiveUsers: 2, features: []});
  });

  afterEach(function() {
    envKeys.forEach(function(key) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    });
  });

  function user(values) {
    const data = Object.assign({companyId: 1, end_date: null}, values);
    return {
      id: data.id,
      companyId: data.companyId,
      isNewRecord: data.isNewRecord !== false,
      _previousDataValues: data.previous || {},
      getDataValue: function(key) { return data[key]; },
    };
  }

  function fakeUserModel(args) {
    return {
      get_active_user_filter: function() { return {}; },
      count: function() { return Promise.resolve(args.activeCount); },
      findAll: function() { return Promise.resolve(args.existing || []); },
    };
  }

  it('blocks a new active user at the licensed limit', async function() {
    const User = fakeUserModel({activeCount: 2});

    try {
      await seatLimit.assertUserSaveWithinLimit({User, user: user({}), options: {}});
      throw new Error('Expected seat enforcement to reject');
    } catch (error) {
      expect(error.code).to.equal('LICENSE_SEAT_LIMIT_EXCEEDED');
      expect(error.maxActiveUsers).to.equal(2);
    }
  });

  it('does not enforce metadata from an invalid unsigned production license', async function() {
    process.env.NODE_ENV = 'production';
    const User = fakeUserModel({activeCount: 2});

    await seatLimit.assertUserSaveWithinLimit({User, user: user({}), options: {}});
  });

  it('allows inactive users and edits to already active users', async function() {
    const User = fakeUserModel({activeCount: 2});

    await seatLimit.assertUserSaveWithinLimit({
      User,
      user: user({end_date: '2020-01-01'}),
      options: {},
    });
    await seatLimit.assertUserSaveWithinLimit({
      User,
      user: user({
        id: 7,
        isNewRecord: false,
        previous: {companyId: 1, end_date: null},
      }),
      options: {},
    });
  });

  it('blocks reactivation when no seat is available', async function() {
    const User = fakeUserModel({activeCount: 2});
    let error;

    try {
      await seatLimit.assertUserSaveWithinLimit({
        User,
        user: user({
          id: 7,
          isNewRecord: false,
          previous: {companyId: 1, end_date: '2020-01-01'},
        }),
        options: {},
      });
    } catch (caught) {
      error = caught;
    }

    expect(error.code).to.equal('LICENSE_SEAT_LIMIT_EXCEEDED');
  });

  it('allows a bulk replacement without increasing active seats', async function() {
    const existingActive = user({id: 4, isNewRecord: false, end_date: null});
    const User = fakeUserModel({activeCount: 2, existing: [existingActive]});

    await seatLimit.assertBulkSaveWithinLimit({
      User,
      users: [
        user({id: 4, isNewRecord: false, end_date: '2020-01-01'}),
        user({end_date: null}),
      ],
      options: {},
    });
  });

  it('blocks a bulk operation whose final active count exceeds the limit', async function() {
    const User = fakeUserModel({activeCount: 1, existing: []});
    let error;

    try {
      await seatLimit.assertBulkSaveWithinLimit({
        User,
        users: [user({}), user({})],
        options: {},
      });
    } catch (caught) {
      error = caught;
    }

    expect(error.code).to.equal('LICENSE_SEAT_LIMIT_EXCEEDED');
  });

  it('enforces the limit through Sequelize create hooks', async function() {
    const sequelize = new Sequelize('sqlite::memory:', {logging: false});
    const Company = sequelize.define('SeatTestCompany', {name: Sequelize.STRING});
    const User = defineUser(sequelize, Sequelize.DataTypes);
    User.belongsTo(Company, {foreignKey: 'companyId'});

    try {
      await sequelize.sync({force: true});
      const company = await Company.create({name: 'Seat Test'});
      const values = index => ({
        email: 'seat-' + index + '@test.com',
        password: 'hash',
        name: 'Seat',
        lastname: String(index),
        companyId: company.id,
      });
      await User.create(values(1));
      await User.create(values(2));

      let error;
      try {
        await User.create(values(3));
      } catch (caught) {
        error = caught;
      }
      expect(error).to.have.property('code', 'LICENSE_SEAT_LIMIT_EXCEEDED');
      expect(await User.count()).to.equal(2);
    } finally {
      await sequelize.close();
    }
  });
});
