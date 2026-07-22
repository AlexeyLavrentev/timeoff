"use strict";

const expect = require("chai").expect;
const { getLeaveForUserView } = require("../../../lib/model/leave");

describe("Leave view lookup", function() {
  const makeOwner = function(overrides) {
    return Object.assign({id: 12, companyId: 3, DepartmentId: 20}, overrides);
  };

  const makeActingUser = function(overrides) {
    return Object.assign({
      id: 7,
      companyId: 3,
      DepartmentId: 10,
      promise_can_view_all_absences: function() {
        return Promise.resolve(false);
      },
      promise_supervised_departments: function() {
        return Promise.resolve([]);
      },
    }, overrides);
  };

  const makeLookup = function({owner, actingUser, leaves}) {
    const leaveOwner = owner || makeOwner();
    const leave = {
      id: 99,
      userId: leaveOwner.id,
      getUser: function() {
        return Promise.resolve(leaveOwner);
      },
    };
    const dbModel = {
      Leave: {
        findAll: function() {
          return Promise.resolve(typeof leaves === "undefined" ? [leave] : leaves);
        },
      },
      User: function() {},
    };

    return {
      actingUser: actingUser || makeActingUser(),
      leave,
      dbModel,
    };
  };

  const expectNotFound = async function(args) {
    try {
      await getLeaveForUserView(args);
      throw new Error("Expected lookup to fail");
    } catch (error) {
      expect(error.statusCode).to.equal(404);
    }
  };

  it("marks a missing leave as not found", async function() {
    const lookup = makeLookup({leaves: []});

    await expectNotFound({
      actingUser: lookup.actingUser,
      leaveId: 99,
      dbModel: lookup.dbModel,
    });
  });

  it("marks a cross-company leave as not found", async function() {
    const dbModel = {
      Leave: {
        findAll: function() {
          return Promise.resolve([]);
        },
      },
      User: function() {},
    };

    await expectNotFound({
      actingUser: makeActingUser(),
      leaveId: 99,
      dbModel,
    });
  });

  it("hides a same-company leave owned by a user in an unrelated department", async function() {
    const lookup = makeLookup({});
    await expectNotFound({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    });
  });

  it("allows a user to view their own leave", async function() {
    const owner = makeOwner({id: 7});
    const lookup = makeLookup({
      owner,
      actingUser: makeActingUser({id: 7, DepartmentId: null}),
    });

    expect(await getLeaveForUserView({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    })).to.equal(lookup.leave);
  });

  it("allows a user to view a leave in their own department", async function() {
    const lookup = makeLookup({
      actingUser: makeActingUser({DepartmentId: 20}),
    });

    expect(await getLeaveForUserView({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    })).to.equal(lookup.leave);
  });

  it("allows a user with global absence visibility", async function() {
    const lookup = makeLookup({
      actingUser: makeActingUser({
        DepartmentId: null,
        promise_can_view_all_absences: function() {
          return Promise.resolve(true);
        },
      }),
    });

    expect(await getLeaveForUserView({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    })).to.equal(lookup.leave);
  });

  it("allows a supervisor to view a leave in a supervised department", async function() {
    const lookup = makeLookup({
      actingUser: makeActingUser({
        promise_supervised_departments: function() {
          return Promise.resolve([{id: 20}]);
        },
      }),
    });

    expect(await getLeaveForUserView({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    })).to.equal(lookup.leave);
  });

  it("denies a user with no supervised departments", async function() {
    const lookup = makeLookup({});
    await expectNotFound({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    });
  });

  it("lets an acting user without a department rely only on supervised access", async function() {
    const lookup = makeLookup({
      actingUser: makeActingUser({DepartmentId: null}),
    });
    await expectNotFound({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    });

    const supervisedLookup = makeLookup({
      actingUser: makeActingUser({
        DepartmentId: null,
        promise_supervised_departments: function() {
          return Promise.resolve([{id: 20}]);
        },
      }),
    });
    expect(await getLeaveForUserView({
      actingUser: supervisedLookup.actingUser,
      leaveId: supervisedLookup.leave.id,
      dbModel: supervisedLookup.dbModel,
    })).to.equal(supervisedLookup.leave);
  });

  it("denies a leave owner without a department", async function() {
    const lookup = makeLookup({owner: makeOwner({DepartmentId: null})});
    await expectNotFound({
      actingUser: lookup.actingUser,
      leaveId: lookup.leave.id,
      dbModel: lookup.dbModel,
    });
  });

  it("matches numeric and string user and department IDs", async function() {
    const selfLookup = makeLookup({
      owner: makeOwner({id: "7"}),
      actingUser: makeActingUser({id: 7}),
    });
    expect(await getLeaveForUserView({
      actingUser: selfLookup.actingUser,
      leaveId: selfLookup.leave.id,
      dbModel: selfLookup.dbModel,
    })).to.equal(selfLookup.leave);

    const supervisorLookup = makeLookup({
      owner: makeOwner({DepartmentId: "20"}),
      actingUser: makeActingUser({
        promise_supervised_departments: function() {
          return Promise.resolve([{id: 20}]);
        },
      }),
    });
    expect(await getLeaveForUserView({
      actingUser: supervisorLookup.actingUser,
      leaveId: supervisorLookup.leave.id,
      dbModel: supervisorLookup.dbModel,
    })).to.equal(supervisorLookup.leave);
  });
});
