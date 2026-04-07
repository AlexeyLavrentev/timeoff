'use strict';

module.exports = {
  policy : require('./policy'),
  providers : {
    sso : require('../sso'),
  },
  settings : require('./settings'),
};
