'use strict';

var By = require('selenium-webdriver').By;

module.exports = function(args) {
  return args.driver
    .findElements(By.css(args.selector))
    .then(function(elements) {
      return elements.length > 0;
    });
};
