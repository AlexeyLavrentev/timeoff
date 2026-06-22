"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("AJAX error handling", function() {
  it("shows a localized fallback instead of leaving summaries loading forever", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../public/js/global.js"),
      "utf8"
    );

    expect(source).to.contain("error: function()");
    expect(source).to.contain(".text(translations.requestFailed)");
  });

  it("exposes the localized request failure message to browser scripts", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../views/layouts/main.hbs"),
      "utf8"
    );

    expect(source).to.contain('requestFailed: "{{t "errors.requestFailed"}}"');
  });
});
