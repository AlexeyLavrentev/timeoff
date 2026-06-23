"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("Calendar feed response", function() {
  it("declares the iCalendar MIME type", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/feed.js"),
      "utf8"
    );

    expect(source).to.contain("res.type('text/calendar').send");
  });
});
