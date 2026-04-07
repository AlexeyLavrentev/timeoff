'use strict';

var webdriver  = require('selenium-webdriver'),
By             = require('selenium-webdriver').By,
Key            = require('selenium-webdriver').Key,
expect         = require('chai').expect,
_              = require('underscore'),
Promise        = require("bluebird"),
until          = require('selenium-webdriver').until;

var DEFAULT_WAIT_TIMEOUT = 5000;

function fill_form_field(driver, test_case) {
  if (Object.keys(test_case).length === 0 ){
    return Promise.resolve(1);
  }

  return driver.findElement(By.css(test_case.selector))
    .then(function(el){
      if ( test_case.hasOwnProperty('option_selector') ) {
        el.click();
        return el.findElement(By.css( test_case.option_selector ))
          .then(function(optionEl){ return optionEl.click(); });
      } else if ( test_case.hasOwnProperty('tick')) {
        return el.click();
      } else if (test_case.file) {
        return el.sendKeys(test_case.value);
      } else if (test_case.hasOwnProperty('dropdown_option')) {
        return el.click()
          .then(function(){ return driver.findElement(By.css(test_case.dropdown_option)); })
          .then(function(dd){ return dd.click(); });
      } else {
        // Prevent the browser validations to allow backend validations to occur
        if (test_case.change_step) {
          driver.executeScript("return arguments[0].step = '0.1'", el);
        }

        return el.clear().then(function(){
          el.sendKeys(test_case.value);
          // Tabs to trigger the calendars overlays
          // to close so the modal submit button can be clicked
          return el.sendKeys(Key.TAB);
        });
      }
    });
}

function read_alert_texts(driver) {
  return driver.findElements(By.css('div.alert'))
    .then(function(els){
      return Promise.all(_.map(els, function(el){ return el.getText(); }));
    });
}

function wait_for_matching_alert(driver, message, multi_line_message) {
  return driver.wait(function(){
    return read_alert_texts(driver)
      .then(function(texts){
        if (!texts.length) {
          return false;
        }

        if (multi_line_message) {
          return _.any(texts, function(text){ return message.test(text); }) ? texts : false;
        }

        return _.find(texts, function(text){ return message.test(text); }) || false;
      })
      .catch(function(){
        return false;
      });
  }, DEFAULT_WAIT_TIMEOUT);
}

function wait_for_expected_elements(driver, elements_to_check) {
  if (!elements_to_check.length) {
    return Promise.resolve(true);
  }

  return driver.wait(function(){
    return Promise.all(_.map(elements_to_check, function(test_case){
      return driver.findElement(By.css(test_case.selector))
        .then(function(el){
          if (test_case.hasOwnProperty('tick')) {
            return el.isSelected().then(function(yes){
              return yes ? 'on' : 'off';
            });
          }

          return el.getAttribute('value');
        })
        .then(function(value){
          return value === test_case.value;
        });
    }))
    .then(function(checks){
      return _.every(checks, function(check){ return check; });
    })
    .catch(function(){
      return false;
    });
  }, DEFAULT_WAIT_TIMEOUT);
}


var submit_form_func = Promise.promisify( function(args, callback){

  var driver          = args.driver,
      result_callback = callback,
      // Regex to check the message that is shown after form is submitted
      message         = args.message || /.*/,
      // Array of object that have at least two keys: selector - css selector
      // and value - value to be entered
      form_params     = args.form_params || [],

      // Defined how elemts are going to be checked in case of success,
      // if that parameter is omitted - 'form_params' is used instead
      elements_to_check   = args.elements_to_check || form_params,

      // Indicates whether form submission is going to be successful
      should_be_successful = args.should_be_successful || false,

      // Indicate if message to be searched through all messages shown,
      // bu defaul it looks into firts message only
      multi_line_message = args.multi_line_message || false,

      // Indicates if there is a confirmation dialog
      confirm_dialog = args.confirm_dialog || false,

      // CSS selecetor for form submition button
      submit_button_selector = args.submit_button_selector ||'button[type="submit"]';


    Promise.resolve()
      .then(function(){
        return Promise.all(_.map(form_params, function(test_case){
          return fill_form_field(driver, test_case);
        }));
      })
      .then(function(){
        if (confirm_dialog) {
          return driver.executeScript('window.confirm = function(msg) { return true; }');
        }
      })
      .then(function(){
        return driver.findElement(By.css(submit_button_selector));
      })
      .then(function(el){
        return el.click();
      })
      .then(function(){
        return driver.wait(until.elementLocated(By.css('body')), DEFAULT_WAIT_TIMEOUT);
      })
      .then(function(){
        if (!should_be_successful) {
          return wait_for_matching_alert(driver, message, multi_line_message);
        }

        return wait_for_expected_elements(driver, elements_to_check)
          .then(function(){
            return wait_for_matching_alert(driver, message, multi_line_message)
              .catch(function(){
                if (String(message) === '/.*/') {
                  return null;
                }

                return read_alert_texts(driver)
                  .then(function(alertTexts){
                    throw new Error(
                      'Timed out waiting for flash message after successful submit. '
                      + 'Expected: ' + message + '. '
                      + 'Current alerts: ' + JSON.stringify(alertTexts)
                    );
                  });
              });
          });
      })
      .then(function(alertResult){
        if (alertResult && !multi_line_message && typeof alertResult === 'string') {
          expect(alertResult).to.match(message);
        }

        if (alertResult && multi_line_message) {
          expect(
            _.any(alertResult, function(text){ return message.test(text); })
          ).to.be.equal(true);
        }

        result_callback(
          null,
          {
            driver : driver,
          }
        );
      })
      .catch(function(error){
        result_callback(error);
      });
});


module.exports = function(args){
  return args.driver.call(function(){return submit_form_func(args)});
}
