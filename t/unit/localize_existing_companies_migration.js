'use strict';

const expect = require('chai').expect;
const Sequelize = require('sequelize');
const migration = require('../../migrations/20260701150000-localize-existing-kz-ru-companies');

describe('RU/KZ localization migration', function() {
  let sequelize;
  let queryInterface;

  beforeEach(async function() {
    sequelize = new Sequelize('database', null, null, {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    queryInterface = sequelize.getQueryInterface();

    await queryInterface.createTable('Companies', {
      id: {type: Sequelize.INTEGER, primaryKey: true},
      country: {type: Sequelize.STRING, allowNull: false},
      date_format: {type: Sequelize.STRING, allowNull: false},
    });
    await queryInterface.createTable('Departments', {
      id: {type: Sequelize.INTEGER, primaryKey: true},
      name: {type: Sequelize.STRING, allowNull: false},
      companyId: {type: Sequelize.INTEGER, allowNull: false},
    });
    await queryInterface.createTable('LeaveTypes', {
      id: {type: Sequelize.INTEGER, primaryKey: true},
      name: {type: Sequelize.STRING, allowNull: false},
      companyId: {type: Sequelize.INTEGER, allowNull: false},
    });
    await queryInterface.createTable('BankHolidays', {
      id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
      name: {type: Sequelize.STRING, allowNull: false},
      date: {type: Sequelize.DATE, allowNull: false},
      companyId: {type: Sequelize.INTEGER, allowNull: false},
      createdAt: {type: Sequelize.DATE, allowNull: false},
      updatedAt: {type: Sequelize.DATE, allowNull: false},
    });

    const now = new Date();
    await queryInterface.bulkInsert('Companies', [
      {id: 1, country: 'RU', date_format: 'YYYY-MM-DD'},
    ]);
    await queryInterface.bulkInsert('Departments', [
      {id: 1, companyId: 1, name: 'Sales'},
    ]);
    await queryInterface.bulkInsert('LeaveTypes', [
      {id: 1, companyId: 1, name: 'Holiday'},
      {id: 2, companyId: 1, name: 'Sick Leave'},
    ]);
    await queryInterface.bulkInsert('BankHolidays', [
      {
        id: 1,
        companyId: 1,
        name: 'New Year Holidays',
        date: '2026-01-01',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterEach(async function() {
    await sequelize.close();
  });

  it('runs against the historical schema without future model columns', async function() {
    await migration.up(queryInterface, Sequelize);

    const companies = await sequelize.query(
      'SELECT date_format FROM Companies WHERE id = 1',
      {type: Sequelize.QueryTypes.SELECT}
    );
    const departments = await sequelize.query(
      'SELECT name FROM Departments WHERE id = 1',
      {type: Sequelize.QueryTypes.SELECT}
    );
    const leaveTypes = await sequelize.query(
      'SELECT name FROM LeaveTypes ORDER BY id',
      {type: Sequelize.QueryTypes.SELECT}
    );
    const holidays = await sequelize.query(
      'SELECT name, date FROM BankHolidays WHERE companyId = 1',
      {type: Sequelize.QueryTypes.SELECT}
    );

    expect(companies[0].date_format).to.equal('DD.MM.YYYY');
    expect(departments[0].name).to.equal('Продажи');
    expect(leaveTypes.map(row => row.name)).to.deep.equal(['Отпуск', 'Больничный']);
    expect(holidays.some(row => row.name === 'Новогодние каникулы')).to.equal(true);
    expect(holidays.some(row => String(row.date).startsWith('2027-01-01'))).to.equal(true);
  });
});
