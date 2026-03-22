'use strict';

var
  validator      = require('validator'),
  Promise        = require('bluebird'),
  fsExtra        = require('fs'),
  config         = require('../config'),
  moment_tz      = require('moment-timezone'),
  EmailTransport = require('../email'),
  sso            = require('../sso');

Promise.promisifyAll(fsExtra);

var get_url_to_site_root_for_anonymous_session = function(req) {
  return req.get('host').indexOf('app.timeoff') < 0
    ? '/'
    : config.get('promotion_website_domain');
};

module.exports = function(passport) {

  var express = require('express');
  var router  = express.Router();

  router.get('/login/sso/metadata/saml/:companyId', async function(req, res, next) {
    try {
      return await sso.renderSamlMetadata(req, res);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/login', function(req, res){
    res.render('login', {
      allow_create_new_accounts: JSON.parse(config.get('allow_create_new_accounts')),
      title : req.t('titles.login'),
      url_to_the_site_root : get_url_to_site_root_for_anonymous_session(req),
    });
  });

  router.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user) {
      if (err) { return next(err); }

      if (!user) {
        req.session.flash_error(req.t('login.messages.invalidCredentials'));
        return res.redirect_with_session('/login');
      }

      req.logIn(user, function(err) {
        if (err) { return next(err); }

        req.session.flash_message(req.t('login.messages.welcomeBack', {
          name: user.name
        }));

        return res.redirect_with_session('/');
      });
    })(req, res, next);
  });

  router.post('/login/sso', async function(req, res, next) {
    try {
      return await sso.startSsoLogin(req, res);
    } catch (error) {
      console.error('Failed to start SSO login: %s', error && error.stack || error);
      req.session.flash_error(req.t('login.messages.ssoFailed'));
      return res.redirect_with_session('/login/');
    }
  });

  router.get('/login/sso/callback', async function(req, res, next) {
    try {
      return await sso.handleOidcCallback(req, res);
    } catch (error) {
      console.error('OIDC callback failed: %s', error && error.stack || error);
      req.session.flash_error(req.t('login.messages.ssoFailed'));
      return res.redirect_with_session('/login/');
    }
  });

  router.post('/login/sso/callback/saml', async function(req, res, next) {
    try {
      return await sso.handleSamlCallback(req, res);
    } catch (error) {
      console.error('SAML callback failed: %s', error && error.stack || error);
      req.session.flash_error(req.t('login.messages.ssoFailed'));
      return res.redirect_with_session('/login/');
    }
  });

  router.get('/logout', async function(req, res){

      if ( !req.user ) {
          return res.redirect_with_session(303, '/');
      }

      let logoutRedirect = null;

      try {
        logoutRedirect = await sso.performOidcLogout(req);
      } catch (error) {
        console.error('Failed to prepare OIDC logout URL: %s', error && error.stack || error);
      }

      req.logout();
      await sso.destroySession(req);

      return res.redirect(logoutRedirect || res.locals.url_to_the_site_root);
  });

  router.get('/register', function(req, res){

      if ( !JSON.parse(config.get('allow_create_new_accounts')) ) {
        return res.redirect_with_session(res.locals.url_to_the_site_root);
      }

      if ( req.user ) {
        return res.redirect_with_session(303, '/');
      }

      res.render('register',{
        url_to_the_site_root : get_url_to_site_root_for_anonymous_session(req),
        countries            : config.get('countries'),
        timezones_available  : moment_tz.tz.names(),
      });
  });

  router.post('/register', function(req, res){

      if ( req.user ) {
        return res.redirect_with_session(303, '/');
      }

      var email = req.body['email'];
      if (!email){
          req.session.flash_error(req.t('login.messages.emailMissing'));
      } else if ( ! validator.isEmail(email)) {
          req.session.flash_error(req.t('login.messages.emailInvalid'));
      }

      var name = req.body['name'];
      if (!name){
          req.session.flash_error(req.t('login.messages.nameMissing'));
      }

      var lastname = req.body['lastname'];
      if (!lastname) {
          req.session.flash_error(req.t('login.messages.lastNameMissing'));
      }

      var company_name = req.body['company_name'];

      var password = req.body['password'];
      if (!password) {
          req.session.flash_error(req.t('login.messages.passwordBlank'));
      } else if ( password !== req.body['password_confirmed'] ) {
          req.session.flash_error(req.t('login.messages.passwordMismatch'));
      }

      var country_code = req.body['country'];
      if (! validator.matches(country_code, /^[a-z]{2}/i) ){
          req.session.flash_error(req.t('login.messages.countryInvalid'));
      }

      let timezone = validator.trim(req.body['timezone']);
      if ( ! moment_tz.tz.names().find(tz_str => tz_str === timezone) ) {
        req.session.flash_error(req.t('login.messages.timezoneUnknown'));
      }

      if ( req.session.flash_has_errors() ) {
          return res.redirect_with_session('/register/');
      }

      req.app.get('db_model').User.register_new_admin_user({
          email        : email.toLowerCase(),
          password     : password,
          name         : name,
          lastname     : lastname,
          company_name : company_name,
          country_code : country_code,
          timezone     : timezone,
      })
      .then(function(user){
        var email = new EmailTransport();

        return email.promise_registration_email({
          user : user,
        })
        .then(function(){
          return Promise.resolve(user);
        });
      })
      .then(function(user){
        req.logIn(user, function(err) {
          if (err) { return next(err); }

          req.session.flash_message(
              req.t('login.messages.registrationComplete')
          );

          return res.redirect_with_session('/');
        });

      })
      .catch(function(error){
          console.error(
              'An error occurred when trying to register new user '
                  + email + ' : ' + error
          );

          req.session.flash_error(
            req.t('login.messages.registrationFailed', {
              reason: error.show_to_user ? error : req.t('login.messages.contactSupport')
            })
          );

          return res.redirect_with_session('/register/');
      });

  });

  router.get('/forgot-password/', function(req, res){

    res.render('forgot_password',{
      url_to_the_site_root : get_url_to_site_root_for_anonymous_session(req),
    });
  });

  router.post('/forgot-password/', function(req, res){
    var email = req.body['email'];

    if (!email){
      req.session.flash_error(req.t('login.messages.emailMissing'));

    } else if ( ! validator.isEmail(email)) {
      req.session.flash_error(req.t('login.messages.emailInvalid'));
    }

    if ( req.session.flash_has_errors() ) {
      return res.redirect_with_session('./');
    }

    var success_msg = req.t('login.messages.forgotPasswordSent');

    email = email.toLowerCase();

    req.app.get('db_model').User.find_by_email(email)
      .then(function(user){

        if (!user) {
          req.session.flash_message(success_msg);

          var error = new Error('');
          error.do_not_report = true;
          throw error;
        }

        return Promise.resolve(user);
      })
      .then(function(user){
        var Email = new EmailTransport();

        return Email.promise_forgot_password_email({
          user : user,
        });
      })
      .then(function(){
          req.session.flash_message(success_msg);
          return res.redirect_with_session('./');
      })
      .catch(function(error){

        if (error.do_not_report ){
          return res.redirect_with_session('./');
        }

        console.error('An error occurred while submittin forgot password form: '+error);
        req.session.flash_error(req.t('login.messages.forgotPasswordFailed'));
        return res.redirect_with_session('./');
      });

  });

  router.get('/reset-password/', function(req, res){

    var token = req.query['t'];

    req.app.get('db_model').User.get_user_by_reset_password_token(token)
      .then(function(user){
        if (! user) {
          req.session.flash_error(req.t('login.messages.resetLinkUnknown'));
          return res.redirect_with_session('/forgot-password/');
        }

        res.render('reset_password',{
          url_to_the_site_root : get_url_to_site_root_for_anonymous_session(req),
          token : token,
        });
      });
  });

  router.post('/reset-password/', function(req, res){

    var token        = req.body['t'],
    password         = req.body['password'],
    confirm_password = req.body['confirm_password'];


    if (password !== confirm_password) {
      req.session.flash_error(req.t('login.messages.resetPasswordMismatch'));
      return res.redirect_with_session('/reset-password/?t='+token);
    }

    req.app.get('db_model').User.get_user_by_reset_password_token(token)
      .then(function(user){
        if (! user) {
          req.session.flash_error(req.t('login.messages.resetLinkUnknown'));
          return res.redirect_with_session('/forgot-password/');
        }

        return Promise.resolve(user);
      })
      .then(function(user){
        user.password = req.app.get('db_model').User.hashify_password(password);
        return user.save();
      })
      .then(function(user){
        var Email = new EmailTransport();

        return Email.promise_reset_password_email({
          user : user,
        });
      })
      .then(function(){
        req.session.flash_message(req.t('login.messages.resetPasswordUseNew'));
          return res.redirect_with_session('/login/');
      });
  });

  return router;
};
