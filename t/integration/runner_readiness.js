'use strict';

const {By, until} = require('selenium-webdriver');
const {expect} = require('chai');
const buildDriver = require('../lib/build_driver');
const config = require('../lib/config');

describe('Integration runner readiness', function() {
  this.timeout(30000);

  let driver;

  it('serves the registration page to a fresh browser session', async function() {
    driver = await buildDriver();
    await driver.manage().setTimeouts({pageLoad: 10000, script: 10000});
    await driver.get(config.get_application_host() + 'register/');
    const companyName = await driver.wait(
      until.elementLocated(By.id('company_name_inp')),
      5000
    );

    expect(await companyName.getAttribute('name')).to.equal('company_name');
  });

  afterEach(async function() {
    if (driver) await driver.quit();
  });
});
