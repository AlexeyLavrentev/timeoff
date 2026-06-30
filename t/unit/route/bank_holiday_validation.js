"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("Bank holiday batch validation", function() {
  it("validates all rows before starting database writes", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/bankHolidays.js"),
      "utf8"
    );
    const validationIndex = source.indexOf("existingBankHolidayUpdates =");
    const errorGateIndex = source.indexOf("if (req.session.flash_has_errors())");
    const writeIndex = source.indexOf("model.BankHoliday.create(newBankHolidayAttributes)");

    expect(validationIndex).to.be.greaterThan(-1);
    expect(errorGateIndex).to.be.greaterThan(validationIndex);
    expect(writeIndex).to.be.greaterThan(errorGateIndex);
    expect(source).to.contain("bankHolidays.messages.nameRequired");
  });

  it("rejects duplicate branch calendar names before create", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/bankHolidays.js"),
      "utf8"
    );

    expect(source).to.contain("calendarNameDuplicate");
    expect(source).to.contain("model.WorkCalendar.findAll");
  });
});
