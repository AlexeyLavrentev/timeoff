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

  function triggerEl(idx) {
    return driver.findElements(By.css('.requests-user-details-summary-trigger'))
      .then(function(els){ return els[idx]; });
  }
  function triggerCount() {
    return driver.findElements(By.css('.requests-user-details-summary-trigger'))
      .then(function(els){ return els.length; });
  }
  function isVisibleViaState(idx) {
    return driver.executeScript(function(i){
      var triggers = document.querySelectorAll('.requests-user-details-summary-trigger');
      var t = triggers[i];
      if (!t) { return false; }
      var inst = window.jQuery(t).data('bs.popover');
      var tip = inst && inst.tip();
      return !!(tip && tip.is(':visible'));
    }, idx);
  }
  function describedBy(idx) {
    return driver.executeScript(function(i){
      var t = document.querySelectorAll('.requests-user-details-summary-trigger')[i];
      return t ? (t.getAttribute('aria-describedby') || '') : '';
    }, idx);
  }
  function visibleRequestsPopoverCount() {
    return driver.executeScript(function(){
      var triggers = document.querySelectorAll('.requests-user-details-summary-trigger');
      var n = 0;
      for (var i = 0; i < triggers.length; i++) {
        var inst = window.jQuery(triggers[i]).data('bs.popover');
        var tip = inst && inst.tip();
        if (tip && tip.is(':visible')) { n++; }
      }
      return n;
    });
  }

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

  it('Signs admin out and employee in', function(done){
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

  it('Books two leaves so two pending requests appear for the admin', function(done){
    var day1 = company_today().add(7, 'days').format('YYYY-MM-DD');
    var day2 = company_today().add(14, 'days').format('YYYY-MM-DD');
    open_page_func({ url: application_host + 'calendar/', driver: driver })
      .then(function(){ return driver.findElement(By.css('#book_time_off_btn')).click(); })
      .then(function(){ return driver.sleep(500); })
      .then(function(){
        return submit_form_func({
          driver: driver,
          form_params: [{ selector: 'input.book-leave-from-input', value: day1 },
                        { selector: 'input.book-leave-to-input', value: day1 }],
          submit_button_selector: '.book-leave-modal button[type="submit"]',
          should_be_successful: true, elements_to_check: [],
          message: /New leave request was added/,
        });
      })
      .then(function(){ return driver.findElement(By.css('#book_time_off_btn')).click(); })
      .then(function(){ return driver.sleep(500); })
      .then(function(){
        return submit_form_func({
          driver: driver,
          form_params: [{ selector: 'input.book-leave-from-input', value: day2 },
                        { selector: 'input.book-leave-to-input', value: day2 }],
          submit_button_selector: '.book-leave-modal button[type="submit"]',
          should_be_successful: true, elements_to_check: [],
          message: /New leave request was added/,
        });
      })
      .then(function(){ done(); });
  });

  it('Signs employee out and admin back in', function(done){
    logout_user_func({ application_host: application_host, driver: driver })
      .then(function(){
        return login_user_func({
          application_host: application_host, driver: driver, user_email: adminEmail,
        });
      })
      .then(function(){ done(); });
  });

  it('Opens the requests page with two pending rows', function(done){
    open_page_func({ url: application_host + 'requests/', driver: driver })
      .then(triggerCount)
      .then(function(n){
        expect(n, 'expected two requests-page triggers').to.equal(2);
      })
      .then(function(){ done(); });
  });

  it('Each trigger is a real <button> reachable with Tab and has a non-empty accessible name', function(done){
    driver.executeScript(function(){
        var triggers = document.querySelectorAll('.requests-user-details-summary-trigger');
        var info = [];
        for (var i = 0; i < triggers.length; i++) {
          info.push({
            tag: triggers[i].tagName.toLowerCase(),
            name: (triggers[i].getAttribute('aria-label') || '').trim()
          });
        }
        return info;
      })
      .then(function(info){
        info.forEach(function(t){
          expect(t.tag).to.equal('button');
          expect(t.name.length).to.be.greaterThan(0);
        });
      })
      .then(function(){ done(); });
  });

  it('Keyboard focus on trigger #0 shows its popover immediately (no 700ms delay)', function(done){
    driver.executeScript(function(){
      document.querySelectorAll('.requests-user-details-summary-trigger')[0].focus();
    })
      .then(function(){
        return driver.wait(function(){ return isVisibleViaState(0); }, 1500);
      })
      .then(function(){ done(); });
  });

  it('aria-describedby on trigger #0 points at a visible .popover[role=tooltip]', function(done){
    driver.executeScript(function(){
        var t = document.querySelectorAll('.requests-user-details-summary-trigger')[0];
        var id = t.getAttribute('aria-describedby') || '';
        var pop = id ? document.getElementById(id) : null;
        return { id: id, exists: !!pop, role: pop ? pop.getAttribute('role') : null };
      })
      .then(function(info){
        expect(info.id.length).to.be.greaterThan(0);
        expect(info.exists).to.equal(true);
        expect(info.role).to.equal('tooltip');
      })
      .then(function(){ done(); });
  });

  it('Replaces the AJAX loading text with the real summary', function(done){
    driver.wait(function(){
        return driver.executeScript(function(){
          var t = document.querySelectorAll('.requests-user-details-summary-trigger')[0];
          var id = t.getAttribute('aria-describedby') || '';
          var pop = id ? document.getElementById(id) : null;
          if (!pop) { return false; }
          var txt = (pop.textContent || '').trim();
          return txt.length > 0 && !/loading/i.test(txt);
        });
      }, 4000)
      .then(function(){ done(); });
  });

  it('Enter on the focused trigger does NOT close the focus-opened popover', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ENTER); })
      .then(function(){ return driver.sleep(200); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v, 'popover should still be visible after Enter').to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('Escape closes the popover and leaves focus on the trigger', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ESCAPE); })
      .then(function(){ return driver.sleep(250); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v).to.equal(false);
      })
      .then(function(){
        return driver.executeScript(function(){
          var t = document.querySelectorAll('.requests-user-details-summary-trigger')[0];
          return document.activeElement === t;
        });
      })
      .then(function(onTrigger){
        expect(onTrigger).to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('Enter re-opens the popover after Escape without a new focusin', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ENTER); })
      .then(function(){ return driver.sleep(200); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v, 'popover should re-open on Enter after Escape').to.equal(true);
      })
      .then(function(){ done(); });
  });

  it('A second Escape closes the re-opened popover', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.ESCAPE); })
      .then(function(){ return driver.sleep(250); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v).to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('Single-open: focusing trigger #0 shows its popover with aria-describedby', function(done){
    // Reload the requests page so every trigger starts from a fresh state
    // (no leftover timers / pinned flags from the keyboard scenario above).
    open_page_func({ url: application_host + 'requests/', driver: driver })
      .then(function(){ return driver.sleep(150); })
      .then(function(){
        return driver.executeScript(function(){
          document.querySelectorAll('.requests-user-details-summary-trigger')[0].focus();
        });
      })
      .then(function(){ return driver.wait(function(){ return isVisibleViaState(0); }, 1500); })
      .then(function(){ return describedBy(0); })
      .then(function(id0){
        expect(id0.length, 'trigger #0 should have aria-describedby when open').to.be.greaterThan(0);
      })
      .then(function(){ done(); });
  });

  it('Single-open: focusing trigger #1 hides trigger #0 and its aria-describedby', function(done){
    driver.executeScript(function(){
        document.querySelectorAll('.requests-user-details-summary-trigger')[1].focus();
      })
      .then(function(){ return driver.sleep(300); })
      .then(function(){ return isVisibleViaState(1); })
      .then(function(v1){
        expect(v1, 'trigger #1 popover should be visible').to.equal(true);
      })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v0){
        expect(v0, 'trigger #0 popover should be hidden after #1 opened').to.equal(false);
      })
      .then(function(){ return describedBy(0); })
      .then(function(id0After){
        expect(id0After, 'aria-describedby must be removed from #0').to.equal('');
      })
      .then(function(){ done(); });
  });

  it('Single-open: exactly one requests employee-summary popover visible at a time', function(done){
    visibleRequestsPopoverCount()
      .then(function(n){
        expect(n, 'exactly one requests popover visible').to.equal(1);
      })
      .then(function(){ done(); });
  });

  it('A real Selenium click opens the popover exactly once (no duplicate show)', function(done){
    // Reload for a clean state, then instrument the show event once.
    open_page_func({ url: application_host + 'requests/', driver: driver })
      .then(function(){
        return driver.executeScript(function(){
          window.__employeeSummaryShowCount = 0;
          window.jQuery('.requests-user-details-summary-trigger')
            .on('show.bs.popover.test', function(){
              window.__employeeSummaryShowCount += 1;
            });
        });
      })
      // Click trigger #0 from an unfocused state (real pointer down → focusin → click).
      .then(function(){ return triggerEl(0); })
      .then(function(el){
        // Move focus off the trigger first to prove the click path.
        return driver.executeScript('document.body.focus();')
          .then(function(){ return driver.sleep(100); })
          .then(function(){ return el.click(); });
      })
      .then(function(){ return driver.sleep(250); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v, 'popover should be visible after one click').to.equal(true);
      })
      .then(function(){
        return driver.executeScript('return window.__employeeSummaryShowCount;');
      })
      .then(function(c){
        expect(c, 'show.bs.popover should fire exactly once per click').to.equal(1);
      })
      .then(function(){
        // And no pending showTimer should remain.
        return driver.executeScript(function(){
          var t = document.querySelectorAll('.requests-user-details-summary-trigger')[0];
          var s = window.jQuery(t).data('userSummaryState');
          return s ? s.showTimer : 'no-state';
        });
      })
      .then(function(timer){
        expect(timer, 'no pending showTimer should remain').to.not.be.ok;
      })
      .then(function(){
        // Cleanup the test-only handler.
        return driver.executeScript(function(){
          window.jQuery('.requests-user-details-summary-trigger').off('show.bs.popover.test');
        });
      })
      .then(function(){ done(); });
  });

  it('A second real Selenium click closes the pinned popover', function(done){
    triggerEl(0)
      .then(function(el){ return el.click(); })
      .then(function(){ return driver.sleep(250); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v, 'popover should close on second click').to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('Click outside closes a pinned popover', function(done){
    triggerEl(0)
      .then(function(el){
        return driver.executeScript('document.body.focus();')
          .then(function(){ return driver.sleep(100); })
          .then(function(){ return el.click(); });
      })
      .then(function(){ return driver.sleep(250); })
      .then(function(){
        return driver.executeScript(function(){
          document.body.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
        });
      })
      .then(function(){ return driver.sleep(250); })
      .then(function(){ return isVisibleViaState(0); })
      .then(function(v){
        expect(v, 'popover should close after click outside').to.equal(false);
      })
      .then(function(){ done(); });
  });

  it('Team View employee-summary trigger is NOT driven by the manual controller (regression)', function(done){
    // Open Team View and confirm the <td> trigger has no manual state and
    // still opens via hover-only Bootstrap popover. This guards against the
    // controller leaking onto Team View now that it is scoped by marker class.
    open_page_func({ url: application_host + 'calendar/teamview/', driver: driver })
      .then(function(){
        return driver.executeScript(function(){
          var td = document.querySelector('.user-details-summary-trigger:not(.requests-user-details-summary-trigger)');
          if (!td) { return {found: false}; }
          var $td = window.jQuery(td);
          var hasState = !!$td.data('userSummaryState');
          var inst = $td.data('bs.popover');
          // Bootstrap hover-only stores its own internal state; our manual
          // state is absent.
          return {
            found: true,
            tag: td.tagName.toLowerCase(),
            hasManualState: hasState,
            hasBsPopover: !!inst
          };
        });
      })
      .then(function(info){
        expect(info.found, 'expected a Team View user-details trigger').to.equal(true);
        expect(info.tag).to.equal('td');
        expect(info.hasManualState, 'manual state must NOT be attached to Team View').to.equal(false);
        expect(info.hasBsPopover, 'Team View trigger should still have a Bootstrap popover').to.equal(true);
      })
      .then(function(){ done(); });
  });

  after(function(done){
    driver.quit().then(function(){ done(); });
  });

});
