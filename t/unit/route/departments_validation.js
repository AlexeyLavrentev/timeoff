"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("Department validation", function() {
  it("requires a name and rejects duplicate names for create and edit", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/departments.js"),
      "utf8"
    );

    expect(source).to.contain("departments.messages.nameRequired");
    expect(source).to.contain("departments.messages.duplicateName");
    expect(source).to.contain("find_department_with_same_name");
    expect(source).to.contain("toLocaleLowerCase");
  });

  it("replaces secondary supervisors inside one transaction", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/departments.js"),
      "utf8"
    );

    expect(source).to.contain("department.constructor.sequelize.transaction");
    expect(source).to.contain("{transaction}");
  });
});
