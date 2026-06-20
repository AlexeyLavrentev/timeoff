'use strict';

const path = require('path');

const defaultPartialTemplatePath = path.join(__dirname, '..', 'views', 'partials');
let partialTemplatePaths = [defaultPartialTemplatePath];

function normalize(paths) {
  return []
    .concat(paths || [])
    .filter(Boolean)
    .filter((templatePath, index, allPaths) => allPaths.indexOf(templatePath) === index);
}

function get() {
  return partialTemplatePaths.slice();
}

function reset() {
  partialTemplatePaths = [defaultPartialTemplatePath];
}

function set(paths) {
  partialTemplatePaths = normalize(paths)
    .filter(templatePath => templatePath !== defaultPartialTemplatePath);
  partialTemplatePaths.unshift(defaultPartialTemplatePath);

  return get();
}

module.exports = {
  defaultPartialTemplatePath,
  get,
  reset,
  set,
};
