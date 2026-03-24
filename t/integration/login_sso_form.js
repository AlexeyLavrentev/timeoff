'use strict';

var By               = require('selenium-webdriver').By,
    expect           = require('chai').expect,
    config           = require('../lib/config'),
    build_driver     = require('../lib/build_driver'),
    application_host = config.get_application_host();

describe('Login page SSO UX', function(){

  this.timeout(config.get_execution_timeout());

  var driver;

  before(function(){
    driver = build_driver();
    driver.manage().window().setSize(1024, 768);
    return driver.get(application_host + 'login/');
  });

  it('renders password login and a dedicated SSO entry point', function(){
    return driver.findElements(By.css('form'))
      .then(function(forms){
        expect(forms).to.have.length(1);
      })
      .then(function(){
        return driver.findElement(By.css('form#local_login_form input[name="username"]'));
      })
      .then(function(){
        return driver.findElement(By.css('form#local_login_form input[name="password"]'));
      })
      .then(function(){
        return driver.findElements(By.css('form#sso_discovery_form'));
      })
      .then(function(ssoForms){
        expect(ssoForms).to.have.length(0);
      })
      .then(function(){
        return driver.findElement(By.css('#go_to_sso_login'));
      });
  });

  it('renders dedicated SSO discovery page', function(){
    return driver.get(application_host + 'login/sso/')
      .then(function(){
        return driver.findElement(By.css('form#sso_discovery_form input[name="email"]'));
      })
      .then(function(){
        return driver.findElements(By.css('form#sso_discovery_form input[name="password"]'));
      })
      .then(function(passwordInputs){
        expect(passwordInputs).to.have.length(0);
      })
      .then(function(){
        return driver.findElement(By.css('#submit_sso_login'));
      })
      .then(function(){
        return driver.findElement(By.css('#back_to_password_login'));
      });
  });

  after(function(){
    return driver.quit();
  });
});
