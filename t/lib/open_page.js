'use strict';

var webdriver = require('selenium-webdriver');

module.exports = function(args) {

  var url             = args.url,
      driver          = args.driver;

  // Open front page
  return driver
    .get( url )
    .then(function(){
      // "export" current driver
      return {
        driver : driver,
      };
    });
};
