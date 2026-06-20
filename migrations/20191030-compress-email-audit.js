
'use strict';

const
  htmlToText = require('html-to-text'),
  Promise = require('bluebird'),
  models = require('../lib/model/db');

module.exports = {
  up: () => {
    return models.EmailAudit.findAll()
      .then(records => Promise.map(
        records,
        rec => rec.update({body : htmlToText.fromString(rec.body)}),
        {concurrency: 1}
      ))
      .then(() => console.log('Done!'));
  },

  // Do nothing
  down: () => Promise.resolve(),
};
