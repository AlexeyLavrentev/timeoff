"use strict";

const expect = require("chai").expect;
const { getLeaveForUserView } = require("../../../lib/model/leave");

describe("Leave view lookup", function() {
  it("marks a missing or cross-company leave as not found", async function() {
    const dbModel = {
      Leave: {
        findAll: function() {
          return Promise.resolve([]);
        },
      },
      User: function() {},
    };

    try {
      await getLeaveForUserView({
        actingUser: { id: 7, companyId: 3 },
        leaveId: 99,
        dbModel,
      });
      throw new Error("Expected lookup to fail");
    } catch (error) {
      expect(error.statusCode).to.equal(404);
    }
  });
});
