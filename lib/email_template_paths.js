'use strict';

const path = require('path');

const defaultEmailTemplatePath = path.join(__dirname, '..', 'views', 'email');
let emailTemplatePaths = [defaultEmailTemplatePath];

function normalize(paths) {
  return []
    .concat(paths || [])
    .filter(Boolean)
    .filter((templatePath, index, allPaths) => allPaths.indexOf(templatePath) === index);
}

function get() {
  return emailTemplatePaths.slice();
}

function reset() {
  emailTemplatePaths = [defaultEmailTemplatePath];
}

function set(paths) {
  emailTemplatePaths = normalize(paths);

  if (emailTemplatePaths.indexOf(defaultEmailTemplatePath) === -1) {
    emailTemplatePaths.unshift(defaultEmailTemplatePath);
  }

  return get();
}

module.exports = {
  defaultEmailTemplatePath,
  get,
  reset,
  set,
};
