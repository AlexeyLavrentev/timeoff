"use strict";

const expect = require("chai").expect;
const router = require("../../../lib/route/settings");

describe("Company settings route", function() {
  it("rejects a blank company name before saving", function() {
    const layer = router.stack.find(item =>
      item.route
      && item.route.path === "/company/"
      && item.route.methods.post
    );
    const handler = layer.route.stack[0].handle;
    const errors = [];
    let companyLookups = 0;
    const req = {
      body: {
        name: " ",
        country: "GB",
        date_format: "YYYY-MM-DD",
        timezone: "Europe/London",
        carry_over: "0",
      },
      t(key) {
        return key;
      },
      session: {
        flash_error(message) {
          errors.push(message);
        },
        flash_has_errors() {
          return errors.length > 0;
        },
      },
      user: {
        getCompany() {
          companyLookups += 1;
          return Promise.resolve();
        },
      },
    };
    const res = {
      redirect_with_session(location) {
        expect(location).to.equal("/settings/general/");
      },
    };

    handler(req, res);

    expect(companyLookups).to.equal(0);
    expect(errors).to.include("settings.messages.companyNameRequired");
  });
});
