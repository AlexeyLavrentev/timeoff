'use strict';

const fs = require('fs');
const path = require('path');

const COMMERCIAL_MARKER_PATH = path.resolve(__dirname, '..', '..', '.timeoff-commercial');

const isCommercialEdition = () => (
  fs.existsSync(COMMERCIAL_MARKER_PATH)
  || process.env.TIMEOFF_EDITION === 'commercial'
);

module.exports = {
  COMMERCIAL_MARKER_PATH,
  isCommercialEdition,
};
