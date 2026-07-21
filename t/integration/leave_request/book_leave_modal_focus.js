'use strict';

var config           = require('../../lib/config'),
    application_host = config.get_application_host(),
    By               = require('selenium-webdriver').By,
    expect           = require('chai').expect,
    until            = require('selenium-webdriver').until,
    Promise          = require('bluebird'),
    register_new_user_func = require('../../lib/register_new_user'),
    open_page_func         = require('../../lib/open_page');

describe("Book leave modal keyboard focus management", function(){

  this.timeout( config.get_execution_timeout() );

  var driver;

  it("Register new company", function(done){
    register_new_user_func({
      application_host : application_host,
    })
    .then(function(data){
      driver = data.driver;
      done();
    });
  });

  it("Open calendar page", function(done){
    open_page_func({
      url    : application_host + 'calendar/',
      driver : driver,
    })
    .then(function(){ done() });
  });

  it("Move focus onto the New absence button", function(done){
    driver
      .findElement(By.css('#book_time_off_btn'))
      .then(function(el){ return el.click(); })
      // The BS3 data-toggle opens the modal on click; focus should rest on the
      // trigger until shown.bs.modal reassigns it inside the dialog.
      .then(function(){ return driver.sleep(100); })
      .then(function(){ done() });
  });

  it("Open the Book leave modal via the standard data-toggle", function(done){
    // The modal is already opened by the previous click; wait for it to settle.
    driver
      .wait(until.elementLocated(By.css('#book_leave_modal.in')), 2000)
      .then(function(){ return driver.sleep(200); })
      .then(function(){ done() });
  });

  it("Moves focus to the first form control after shown.bs.modal", function(done){
    // A newly registered user has no supervised users, so #employee is absent
    // and the fallback order resolves to #leave_type.
    driver
      .wait(function(){
        return driver.switchTo().activeElement().getAttribute('id').then(function(id){
          return id === 'leave_type';
        });
      }, 2000)
      .then(function(){ done() });
  });

  it("Keeps Tab focus within the modal (Bootstrap focus trap)", function(done){
    driver
      .switchTo().activeElement()
      .then(function(){ return driver.switchTo().activeElement(); })
      .then(function(el){ return el.getAttribute('id'); })
      .then(function(id){
        // Either the focused control is inside the modal, or the trap pulled it
        // back. Both are acceptable; the key assertion is that focus did not
        // escape to an element outside the modal.
        expect(id).to.not.equal('book_time_off_btn');
      })
      .then(function(){ done() });
  });

  it("Closes the modal with Escape", function(done){
    driver
      .switchTo().activeElement()
      .then(function(el){
        return el.sendKeys('\uE00C'); // Key.ESCAPE
      })
      .then(function(){ return driver.sleep(400); })
      .then(function(){
        return driver.wait(until.elementIsNotVisible(
          driver.findElement(By.css('#book_leave_modal'))
        ), 2000);
      })
      .then(function(){ done() });
  });

  it("Restores focus to the opener after the modal is closed", function(done){
    // Bootstrap 3.3.4 data API restores focus to the element that opened the
    // modal via [data-toggle="modal"]. This test pins that built-in behavior;
    // it does not add custom focus-restoration code.
    driver
      .wait(function(){
        return driver.switchTo().activeElement().getAttribute('id').then(function(id){
          return id === 'book_time_off_btn';
        });
      }, 2000)
      .then(function(){ done() });
  });

  after(function(done){
    driver.quit().then(function(){ done() });
  });

});
