"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("Skip navigation links", function() {
  it("uses the existing localized skip-link key in core templates", function() {
    const views = [
      "department_details.hbs",
      "bankHolidays.hbs",
      "settings_company_integration_api.hbs",
      "departments_bulk_update.hbs",
    ];

    views.forEach(view => {
      const source = fs.readFileSync(
        path.join(__dirname, "../../views", view),
        "utf8"
      );
      expect(source).to.contain('nav.skipToMainContent');
      expect(source).not.to.contain('common.skipToContent');
    });
  });
});
