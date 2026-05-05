
'use strict';

var expect = require('chai').expect,
_          = require('underscore'),
bluebird   = require('bluebird'),
Email      = require('../../lib/email');

describe('Check Email', function(){

  it('Knows how to render and parse template', function(done){

    var email = new Email();

    bluebird.resolve(email.promise_rendered_email_template({
      template_name : 'foobar',
      context : {
        user : {
          name : 'FOO',
          reload_with_session_details : function(){ bluebird.resolve(1); },
        },
      },
    }))
    .then(function(email){

      expect(email.subject).to.be.equal('Email subject goes here');
      expect(email.body).to.match(/Hello FOO\./);

      done();
    });

  });

  it('Renders leave start reminder email for supervisor', function(done){

    var email = new Email();

    bluebird.resolve(email.promise_rendered_email_template({
      template_name : 'leave_start_reminder_to_supervisor',
      context : {
        daysBefore : 14,
        department : { name : 'Operations' },
        recipient  : {
          id       : 2,
          name     : 'Jane',
          lastname : 'Boss',
          email    : 'boss@example.com',
          company  : { get_default_date_format : function(){ return 'YYYY-MM-DD'; } },
          reload_with_session_details : function(){ return bluebird.resolve(this); },
          full_name : function(){ return 'Jane Boss'; },
        },
        employee : {
          id       : 7,
          name     : 'John',
          lastname : 'Doe',
          full_name : function(){ return 'John Doe'; },
        },
        user : {
          company : { get_default_date_format : function(){ return 'YYYY-MM-DD'; } },
          reload_with_session_details : function(){ return bluebird.resolve(this); },
        },
        leave : {
          leave_type : { name : 'Vacation' },
          get : function(key){ return key === 'leave_type' ? this.leave_type : undefined; },
          get_leave_type_name : function(){ return 'Vacation'; },
          get_start_leave_day : function(){
            return { date : '2026-06-19', is_morning_leave : false, is_afternoon_leave : false };
          },
          get_end_leave_day : function(){
            return { date : '2026-06-30', is_morning_leave : false, is_afternoon_leave : false };
          },
        },
      },
    }))
    .then(function(renderedEmail){
      expect(renderedEmail.subject).to.be.equal('Employee leave starts in 14 days');
      expect(renderedEmail.body).to.match(/John Doe/);
      expect(renderedEmail.body).to.match(/Employee details/);

      done();
    })
    .catch(done);

  });
});
