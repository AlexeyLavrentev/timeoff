var webdriver = require('selenium-webdriver'),
    chrome = require('selenium-webdriver/chrome'),
    puppeteer = require('puppeteer'),
    capabilities = process.env.USE_PHANTOMJS ? 'phantomjs' : 'chrome';

module.exports = function() {
  if (capabilities === 'phantomjs') {
    return new webdriver.Builder()
      .withCapabilities(webdriver.Capabilities[capabilities]())
      .build();
  }

  var options = new chrome.Options();
  var chromeBinary = process.env.CHROME_BIN || puppeteer.executablePath();

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
