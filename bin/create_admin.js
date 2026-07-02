'use strict';

/*
 * First-run helper: creates a company and its administrator account from
 * the command line, so operators do not have to temporarily enable public
 * registration to bootstrap an installation.
 *
 * Usage:
 *   npm run create-admin -- --email admin@example.com --company "My Company"
 *
 * Options:
 *   --email     (required) admin login email
 *   --company   (required) company name
 *   --password  admin password; a random one is generated and printed if omitted
 *   --country   ISO country code for the company (default: RU)
 *   --timezone  company timezone (default derived from country)
 *   --name      admin first name (default: Admin)
 *   --lastname  admin last name (default: Admin)
 */

var argv = require('minimist')(process.argv.slice(2));
var crypto = require('crypto');
var validator = require('validator');

var models = require('../lib/model/db');

function fail(message) {
  console.error('Error: ' + message);
  console.error('');
  console.error('Usage: npm run create-admin -- --email admin@example.com --company "My Company" [--password ...] [--country RU] [--timezone Europe/Moscow] [--name Admin] [--lastname Admin]');
  process.exit(1);
}

var email = String(argv.email || '').trim().toLowerCase();
var companyName = String(argv.company || '').trim();
var password = argv.password ? String(argv.password) : null;
var countryCode = String(argv.country || 'RU').trim().toUpperCase();
var timezone = argv.timezone ? String(argv.timezone).trim() : undefined;
var firstName = String(argv.name || 'Admin').trim();
var lastName = String(argv.lastname || 'Admin').trim();

if (!email || !validator.isEmail(email)) {
  fail('--email is required and must be a valid email address');
}

if (!companyName) {
  fail('--company is required');
}

var generatedPassword = false;

if (!password) {
  // URL-safe, no ambiguous characters; 16 chars of base64url ≈ 96 bits
  password = crypto.randomBytes(12).toString('base64url');
  generatedPassword = true;
}

if (password.length < 8) {
  fail('--password must be at least 8 characters long');
}

models.connect()
  .then(function() {
    return models.User.register_new_admin_user({
      email        : email,
      password     : password,
      name         : firstName,
      lastname     : lastName,
      company_name : companyName,
      country_code : countryCode,
      timezone     : timezone,
      activated    : true,
    });
  })
  .then(function(user) {
    console.log('');
    console.log('Administrator account created.');
    console.log('  Company : ' + companyName);
    console.log('  Email   : ' + user.email);
    if (generatedPassword) {
      console.log('  Password: ' + password);
      console.log('');
      console.log('This generated password is shown only once. Store it securely');
      console.log('and change it after the first login.');
    }
    console.log('');
    console.log('You can now sign in at /login/');
    return models.sequelize.close();
  })
  .catch(function(error) {
    console.error(
      'Failed to create administrator: '
      + (error && error.show_to_user ? error.message : (error && error.stack || error))
    );
    return models.sequelize.close()
      .catch(function() {})
      .then(function() {
        process.exit(1);
      });
  });
