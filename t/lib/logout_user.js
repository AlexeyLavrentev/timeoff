'use strict';

var By        = require('selenium-webdriver').By,
    expect    = require('chai').expect,
    until     = require('selenium-webdriver').until,
    element_exists = require('./element_exists');


function logout_user_func(args) {

  var application_host = args.application_host,
      driver           = args.driver,
      logout_link_css_selector = 'li.hidden-xs a[href="/logout/"]';

  return driver
    .get(application_host)
    .then(function(){
      return driver.findElement(By.css('a#me_menu'));
    })
    .then(function(el){ return el.click(); })
    // Make sure that Logout link exists
    .then(function(){
      return element_exists({
        driver : driver,
        selector : logout_link_css_selector,
      });
    })
    .then(function(is_present){
      expect(is_present).to.be.equal(true);
    })
    .then(function(){
      return driver.findElement(By.css(logout_link_css_selector));
    })
    .then(function(el){
      return el.click();
    })
    .then(function(){
      return driver.wait(until.elementLocated(By.css('body')), 5000);
    })
    .then(function(){
      return element_exists({
        driver : driver,
        selector : logout_link_css_selector,
      });
    })
    // Check that there is no more Logout link
    .then(function(is_present){

      expect(is_present).to.be.equal(false);

      return {
        driver : driver,
      };
    });
}


module.exports = function(args){
  return logout_user_func(args);
}
