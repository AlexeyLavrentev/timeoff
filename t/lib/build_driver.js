var fs = require('fs'),
    path = require('path'),
    os = require('os'),
    webdriver = require('selenium-webdriver'),
    chrome = require('selenium-webdriver/chrome'),
    puppeteer = require('puppeteer'),
    capabilities = process.env.USE_PHANTOMJS ? 'phantomjs' : 'chrome';

function findCachedChromeHeadlessShell() {
  var cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');

  if (!fs.existsSync(cacheDir)) {
    return null;
  }

  var pending = [cacheDir];

  while (pending.length) {
    var current = pending.pop();
    var stats = fs.statSync(current);

    if (stats.isFile() && path.basename(current) === 'chrome-headless-shell') {
      return current;
    }

    if (stats.isDirectory()) {
      fs.readdirSync(current).forEach(function(child) {
        pending.push(path.join(current, child));
      });
    }
  }

  return null;
}

function resolveChromeBinary() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  var puppeteerBinary = puppeteer.executablePath();
  if (puppeteerBinary && fs.existsSync(puppeteerBinary)) {
    return puppeteerBinary;
  }

  return findCachedChromeHeadlessShell();
}

module.exports = function() {
  if (capabilities === 'phantomjs') {
    return new webdriver.Builder()
      .withCapabilities(webdriver.Capabilities[capabilities]())
      .build();
  }

  var options = new chrome.Options();
  var chromeBinary = resolveChromeBinary();

  if (chromeBinary) {
    options.setChromeBinaryPath(chromeBinary);
  }

  if (!process.env.SHOW_CHROME) {
    options.addArguments('headless');
    options.addArguments('disable-gpu');
    options.addArguments('no-sandbox');
    options.addArguments('disable-dev-shm-usage');
  }

  return new webdriver.Builder()
    .withCapabilities(webdriver.Capabilities[capabilities]())
    .setChromeOptions(options)
    .build();
};
