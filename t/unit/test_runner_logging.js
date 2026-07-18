"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("Test runner logging", function() {
  it("silences fake email payloads and HTTP access logs in the integration server", function() {
    const testRunner = fs.readFileSync(
      path.join(__dirname, "../../bin/test.js"),
      "utf8"
    );
    const requestIdMiddleware = fs.readFileSync(
      path.join(__dirname, "../../lib/middleware/request_id.js"),
      "utf8"
    );

    expect(testRunner).to.contain("SILENCE_PRETEND_EMAILS: 'true'");
    expect(testRunner).to.contain("SILENCE_HTTP_LOGS: 'true'");
    expect(testRunner).to.contain("LOG_LEVEL: 'error'");
    expect(testRunner).to.contain("SE_SKIP_DRIVER_IN_PATH: 'true'");
    expect(testRunner).to.contain('Running integration batch');
    expect(testRunner).to.contain("'--recursive', 't/unit'");
    expect(requestIdMiddleware).to.contain("process.env.SILENCE_HTTP_LOGS === 'true'");
  });

  it("waits for the integration server's explicit ready signal", function() {
    const testRunner = fs.readFileSync(
      path.join(__dirname, "../../bin/test.js"),
      "utf8"
    );
    const serverEntrypoint = fs.readFileSync(
      path.join(__dirname, "../../bin/wwww"),
      "utf8"
    );

    expect(testRunner).to.contain("'ipc'");
    expect(testRunner).to.contain("server.on('message'");
    expect(testRunner).to.contain("test-server-ready");
    expect(testRunner).not.to.contain('http.get');
    expect(serverEntrypoint).to.contain('process.send');
    expect(serverEntrypoint).to.contain("test-server-ready");
  });
});
