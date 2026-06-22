"use strict";

const expect = require("chai").expect;
const {
  findDuplicateLeaveTypeName,
} = require("../../../lib/model/leave_type_validation");

describe("Leave type name validation", function() {
  it("finds exact and case-insensitive duplicates", function() {
    expect(findDuplicateLeaveTypeName(["Holiday", "Sick", "holiday"]))
      .to.equal("holiday");
  });

  it("allows a unique set and ignores empty optional names", function() {
    expect(findDuplicateLeaveTypeName(["Holiday", "", "Sick"]))
      .to.equal(null);
  });

  it("is used before leave type database writes are assembled", function() {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/settings.js"),
      "utf8"
    );
    const validationIndex = source.indexOf("existingLeaveTypeUpdates =");
    const writeIndex = source.indexOf("model.LeaveType.create(newLeaveTypeAttributes)");

    expect(validationIndex).to.be.greaterThan(-1);
    expect(writeIndex).to.be.greaterThan(validationIndex);
  });
});
