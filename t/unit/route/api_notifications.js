"use strict";

const expect = require("chai").expect;
const router = require("../../../lib/route/api");

describe("Notifications API", function() {
  it("returns HTTP 500 when notification collection fails", async function() {
    const layer = router.stack.find(item =>
      item.route
      && item.route.path === "/notifications/"
      && item.route.methods.get
    );
    const handler = layer.route.stack[0].handle;
    let statusCode = 200;
    let payload;
    const req = {
      user: {
        id: 17,
        promise_leaves_to_be_processed() {
          return Promise.reject(new Error("database unavailable"));
        },
      },
      t() {
        return "Failed to fetch notifications.";
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        payload = value;
        return value;
      },
    };

    await handler(req, res);

    expect(statusCode).to.equal(500);
    expect(payload).to.deep.equal({
      error: "Failed to fetch notifications.",
    });
  });
});
