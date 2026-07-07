'use strict';

const crypto = require('crypto');

const generateToken = () => crypto.randomBytes(32).toString('base64url');

const hashToken = token => crypto
  .createHash('sha256')
  .update(String(token || ''), 'utf8')
  .digest('hex');

module.exports = {
  generateToken,
  hashToken,
};
