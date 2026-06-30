"use strict";

const expect = require("chai").expect;
const router = require("../../../lib/route/settings");

function getHandler() {
  const layer = router.stack.find(item =>
    item.route
    && item.route.path === "/schedule/"
    && item.route.methods.post
  );
  return layer.route.stack[0].handle;
}

describe("Schedule settings route", function() {
  it("responds safely when a requested employee does not exist", function() {
    return new Promise((resolve, reject) => {
      const errors = [];
      const req = {
        body: {
          user_id: "999",
        },
        t(key) {
          return key;
        },
        session: {
          flash_error(message) {
            errors.push(message);
          },
        },
        user: {
          getCompany() {
            return Promise.resolve({
              id: 3,
              getUsers() {
                return Promise.resolve([]);
              },
            });
          },
        },
        app: {
          get() {
            return {};
          },
        },
      };
      const res = {
        redirect_with_session(location) {
          try {
            expect(location).to.equal("/users/");
            expect(errors).to.deep.equal(["schedule.messages.userSaveFailed"]);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      };

      getHandler()(req, res);
    });
  });
});
