'use strict';

var config           = require('../../lib/config'),
    application_host = config.get_application_host(),
    By               = require('selenium-webdriver').By,
    Key              = require('selenium-webdriver').Key,
    until            = require('selenium-webdriver').until,
    expect           = require('chai').expect,

    register_new_user_func = require('../../lib/register_new_user'),
    open_page_func         = require('../../lib/open_page');

describe('Team View horizontal table navigation', function(){

  this.timeout( config.get_execution_timeout() );

  var driver;

  it('Registers a new company (admin)', function(done){
    register_new_user_func({ application_host: application_host })
      .then(function(data){
        driver = data.driver;
        done();
      });
  });

  it('Opens Team View wide enough to require horizontal scroll (12 months)', function(done){
    // 12 months guarantees scrollWidth > clientWidth on the default 1024px window.
    open_page_func({
      url: application_host + 'calendar/teamview/?months=12',
      driver: driver,
    })
      .then(function(){ return driver.wait(until.elementLocated(By.css('.team-view-table-container')), 5000); })
      .then(function(){ return driver.sleep(400); })
      .then(function(){ done(); });
  });

  function firstShell() {
    return driver.executeScript(
      'return document.querySelector(".team-view-table-shell");'
    );
  }
  function firstContainer() {
    return driver.findElement(By.css('.team-view-table-container'));
  }
  function shellClasses() {
    return driver.executeScript(function(){
      var s = document.querySelector('.team-view-table-shell');
      return s ? s.className : '';
    });
  }
  function scrollLeftOf() {
    return driver.executeScript(function(){
      var c = document.querySelector('.team-view-table-container');
      return c ? c.scrollLeft : -1;
    });
  }
  function hasOverflow() {
    return driver.executeScript(function(){
      var c = document.querySelector('.team-view-table-container');
      return c ? (c.scrollWidth - c.clientWidth) > 2 : false;
    });
  }
  function cueVisible() {
    return driver.executeScript(function(){
      var s = document.querySelector('.team-view-table-shell');
      if (!s) { return false; }
      var cue = s.querySelector('.team-view-scroll-cue');
      if (!cue) { return false; }
      return getComputedStyle(cue).opacity !== '0';
    });
  }

  it('Confirms the table actually overflows horizontally', function(done){
    hasOverflow()
      .then(function(v){ expect(v, 'table should overflow at 12 months').to.equal(true); })
      .then(function(){ done(); });
  });

  it('Marks the shell as horizontally scrollable and can-scroll-right at start', function(done){
    shellClasses()
      .then(function(cls){
        expect(cls).to.contain('is-horizontally-scrollable');
        expect(cls).to.contain('can-scroll-right');
        expect(cls, 'no can-scroll-left at the left edge').to.not.contain('can-scroll-left');
      })
      .then(function(){ done(); });
  });

  it('Shows the scroll cue at the start', function(done){
    cueVisible()
      .then(function(v){ expect(v, 'cue should be visible when can-scroll-right').to.equal(true); })
      .then(function(){ done(); });
  });

  it('Focuses the scroll region', function(done){
    driver.executeScript('document.querySelector(".team-view-table-container").focus();')
      .then(function(){
        return driver.executeScript(function(){
          var c = document.querySelector('.team-view-table-container');
          return document.activeElement === c;
        });
      })
      .then(function(isFocused){ expect(isFocused).to.equal(true); })
      .then(function(){ done(); });
  });

  it('ArrowRight increases scrollLeft and keeps focus on the container', function(done){
    scrollLeftOf()
      .then(function(before){
        return driver.switchTo().activeElement()
          .then(function(el){ return el.sendKeys(Key.ARROW_RIGHT); })
          .then(function(){ return driver.sleep(150); })
          .then(function(){ return scrollLeftOf(); })
          .then(function(after){
            expect(after, 'ArrowRight should move scrollLeft forward').to.be.greaterThan(before);
          });
      })
      .then(function(){
        return driver.executeScript(function(){
          var c = document.querySelector('.team-view-table-container');
          return document.activeElement === c;
        });
      })
      .then(function(isFocused){ expect(isFocused, 'focus must stay on the container').to.equal(true); })
      .then(function(){ done(); });
  });

  it('After ArrowRight, can-scroll-left appears on the shell', function(done){
    shellClasses()
      .then(function(cls){ expect(cls).to.contain('can-scroll-left'); })
      .then(function(){ done(); });
  });

  it('End moves to the right edge and removes can-scroll-right', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.END); })
      .then(function(){ return driver.sleep(150); })
      .then(function(){ return shellClasses(); })
      .then(function(cls){
        expect(cls, 'no can-scroll-right at the right edge').to.not.contain('can-scroll-right');
      })
      .then(function(){ return driver.sleep(100); })
      .then(function(){ return cueVisible(); })
      .then(function(v){ expect(v, 'cue should hide at the right edge').to.equal(false); })
      .then(function(){ done(); });
  });

  it('Home returns scrollLeft to zero and restores can-scroll-right', function(done){
    driver.switchTo().activeElement()
      .then(function(el){ return el.sendKeys(Key.HOME); })
      .then(function(){ return driver.sleep(150); })
      .then(function(){ return scrollLeftOf(); })
      .then(function(left){ expect(left).to.equal(0); })
      .then(function(){ return shellClasses(); })
      .then(function(cls){ expect(cls).to.contain('can-scroll-right'); })
      .then(function(){ done(); });
  });

  it('Keyboard on a nested admin link does not scroll the container', function(done){
    // Focus the admin employee-name link inside the table and send ArrowRight:
    // the controller must ignore it (event.target !== container) and leave
    // scrollLeft unchanged, so the link keeps its normal keyboard behaviour.
    driver.findElements(By.css('.teamview-user-list-row .cross-link a'))
      .then(function(els){
        if (!els.length) {
          // Non-admin scenario or no link present: nothing to assert here.
          return;
        }
        var link = els[0];
        return driver.executeScript(function(el){ el.focus(); }, link)
          .then(function(){ return driver.sleep(100); })
          .then(function(){ return scrollLeftOf(); })
          .then(function(before){
            // Send the key directly to the link element (not via activeElement,
            // which can race with the focus change in headless Chrome).
            return link.sendKeys(Key.ARROW_RIGHT)
              .then(function(){ return driver.sleep(150); })
              .then(function(){ return scrollLeftOf(); })
              .then(function(after){
                expect(after, 'container must not scroll from a nested element keypress').to.equal(before);
              });
          });
      })
      .then(function(){ done(); })
      .catch(function(err){ done(err); });
  });

  after(function(done){
    driver.quit().then(function(){ done(); });
  });

});
