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
    const app = fs.readFileSync(
      path.join(__dirname, "../../app.js"),
      "utf8"
    );

    expect(testRunner).to.contain("SILENCE_PRETEND_EMAILS: 'true'");
    expect(testRunner).to.contain("SILENCE_HTTP_LOGS: 'true'");
    expect(testRunner).to.contain('Running integration batch');
    expect(testRunner).to.contain("'--recursive', 't/unit'");
    expect(app).to.contain("process.env.SILENCE_HTTP_LOGS !== 'true'");
  });
});
