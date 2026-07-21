'use strict';

var config           = require('../../lib/config'),
    application_host = config.get_application_host(),
    By               = require('selenium-webdriver').By,
    Key              = require('selenium-webdriver').Key,
    until            = require('selenium-webdriver').until,
    expect           = require('chai').expect,
    moment           = require('moment-timezone'),

    register_new_user_func = require('../../lib/register_new_user'),
    login_user_func        = require('../../lib/login_with_user'),
    logout_user_func       = require('../../lib/logout_user'),
    open_page_func         = require('../../lib/open_page'),
    submit_form_func       = require('../../lib/submit_form'),
    add_new_user_func      = require('../../lib/add_new_user');

function company_today() {
  return moment().tz('Europe/London');
}

describe('Employee summary popover on the requests page (keyboard accessible)', function(){

  this.timeout( config.get_execution_timeout() );

  var driver;
  var adminEmail;
  var employeeEmail = 'employee_' + Date.now() + '@test.com';

  function script(fn) {
    return driver.executeScript('return (' + fn.toString() + ')()');
  }
  function triggerEl() { return driver.findElement(By.css('.user-details-summary-trigger')); }

  it('Registers a new company and remembers the admin email', function(done){
    register_new_user_func({ application_host: application_host })
      .then(function(data){
        driver = data.driver;
        adminEmail = data.email;
        done();
      });
  });

  it('Adds a non-admin employee with a known email', function(done){
    add_new_user_func({
      driver: driver,
      application_host: application_host,
      email: employeeEmail,
    }).then(function(){ done(); });
  });

  it('Signs out admin and signs the employee in', function(done){
    logout_user_func({ application_host: application_host, driver: driver })
      .then(function(){
        return login_user_func({
          application_host: application_host,
          driver: driver,
          user_email: employeeEmail,
        });
      })
      .then(function(){ done(); });
  });

  it('Books a leave as the employee so it appears for approval', function(done){
    var day = company_today().add(7, 'days').format('YYYY-MM-DD');
    open_page_func({ url: application_host + 'calendar/', driver: driver })
      .then(function(){ return driver.findElement(By.css('#book_time_off_btn')).click(); })
      .then(function(){ return driver.sleep(500); })
      .then(function(){
        return submit_form_func({
          driver: driver,
          form_params: [{
            selector: 'input.book-leave-from-input',
            value: day,
          }, {
            selector: 'input.book-leave-to-input',
            value: day,
          }],
          submit_button_selector: '.book-leave-modal button[type="submit"]',
          should_be_successful: true,
          elements_to_check: [],
          message: /New leave request was added/,
        });
      })
      .then(function(){ done(); });
  });

  it('Signs the employee out and the admin back in', function(done){
    logout_user_func({ application_host: application_host, driver: driver })
      .then(function(){
        return login_user_func({
          application_host: application_host,
          driver: driver,
          user_email: adminEmail,
        });
      })
      .then(function(){ done(); });
  });

  it('Opens the requests page; the trigger is a real <button>', function(done){
    open_page_func({ url: application_host + 'requests/', driver: driver })
      .then(function(){ return triggerEl(); })
      .then(function(el){
        return el.getTagName().then(function(tag){
          expect(tag.toLowerCase()).to.equal('button');
        });
      })
      .then(function(){ done(); });
  });

  it('The trigger is keyboard-reachable and has a non-empty accessible name', function(done){
    driver
      .executeScript('document.querySelector(".user-details-summary-trigger").focus()')
      .then(function(){
        return script(function(){
          var el = document.querySelector('.user-details-summary-trigger');
          return {
            activeIsTrigger: document.activeElement === el,
            name: (el.getAttribute('aria-label') || '').trim(),
          };
        });
      })
      .then(function(info){
        expect(info.activeIsTrigger).to.equal(true);
        expect(info.name.length).to.be.greaterThan(0);
      })
      .then(function(){ done(); });
  });

  it('Keyboard focus shows the popover immediately (no 700ms hover delay)', function(done){
    driver
      .wait(function(){
        return script(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = t && $(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      }, 1500)
      .then(function(){ done(); });
  });

  it('Bootstrap wired aria-describedby from the trigger to the visible .popover[role=tooltip]', function(done){
    script(function(){
        var t = document.querySelector('.user-details-summary-trigger');
        var describedBy = t.getAttribute('aria-describedby') || '';
        var pop = describedBy ? document.getElementById(describedBy) : null;
        return {
          describedBy: describedBy,
          popoverExists: !!pop,
          popoverRole: pop ? pop.getAttribute('role') : null,
        };
      })
      .then(function(info){
        expect(info.describedBy.length).to.be.greaterThan(0);
        expect(info.popoverExists).to.equal(true);
        expect(info.popoverRole).to.equal('tooltip');
      })
      .then(function(){ done(); });
  });

  it('Replaces the AJAX loading text with the real summary', function(done){
    driver
      .wait(function(){
        return script(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var describedBy = t.getAttribute('aria-describedby') || '';
          var pop = describedBy ? document.getElementById(describedBy) : null;
          if (!pop) { return false; }
          var txt = (pop.textContent || '').trim();
          // loading text is no longer present once the response lands
          return txt.length > 0 && !/loading/i.test(txt);
        });
      }, 4000)
      .then(function(){ done(); });
  });

  it('Pressing Enter on the focused trigger does NOT close the focus-opened popover', function(done){
    driver
      .switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ENTER); })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return script(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = $(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      })
      .then(function(isVisible){
        expect(isVisible, 'popover should still be visible after Enter on focus-opened trigger').to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('Escape closes the popover', function(done){
    driver
      .switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ESCAPE); })
      .then(function(){ return driver.sleep(250); })
      .then(function(){
        return script(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = $(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      })
      .then(function(isVisible){
        expect(isVisible).to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('After Escape, focus remains on the trigger', function(done){
    script(function(){
        var t = document.querySelector('.user-details-summary-trigger');
        return document.activeElement === t;
      })
      .then(function(isOnTrigger){
        expect(isOnTrigger).to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('Pointer click opens the popover (pin)', function(done){
    // Reload the requests page to start from a clean state.
    open_page_func({ url: application_host + 'requests/', driver: driver })
      .then(function(){
        // Dispatch a pointer-style click via the page. detail:1 marks it as
        // a real pointer activation (keyboard clicks arrive with detail:0).
        return driver.executeScript(function(){
          var el = document.querySelector('.user-details-summary-trigger');
          el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
        });
      })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return driver.executeScript(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = window.jQuery(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      })
      .then(function(open){
        expect(open, 'popover should open on first pointer click').to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('A second pointer click closes the pinned popover', function(done){
    driver
      .executeScript(function(){
        var el = document.querySelector('.user-details-summary-trigger');
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
      })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return driver.executeScript(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = window.jQuery(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      })
      .then(function(open){
        expect(open, 'popover should close on second pointer click').to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('Click outside closes a pinned popover', function(done){
    // Re-open, then click the body.
    driver.executeScript(function(){
        var el = document.querySelector('.user-details-summary-trigger');
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
      })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return driver.executeScript(function(){
          document.body.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
        });
      })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return driver.executeScript(function(){
          var t = document.querySelector('.user-details-summary-trigger');
          var inst = window.jQuery(t).data('bs.popover');
          var tip = inst && inst.tip();
          return !!(tip && tip.is(':visible'));
        });
      })
      .then(function(open){
        expect(open, 'popover should close after click outside').to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('Only one employee-summary popover is visible at a time', function(done){
    // The requests page in this scenario has a single pending row, so this
    // assertion guards against duplicate popovers for the same trigger.
    triggerEl()
      .then(function(el){ return el.click(); })
      .then(function(){ return driver.sleep(200); })
      .then(function(){
        return script(function(){
          var tips = document.querySelectorAll('.popover');
          var visible = 0;
          for (var i = 0; i < tips.length; i++) {
            if (tips[i].offsetParent !== null && tips[i].classList.contains('in')) { visible++; }
          }
          return visible;
        });
      })
      .then(function(visibleCount){
        expect(visibleCount).to.equal(1);
      })
      .then(function(){ done(); });
  });

  after(function(done){
    driver.quit().then(function(){ done(); });
  });

});
