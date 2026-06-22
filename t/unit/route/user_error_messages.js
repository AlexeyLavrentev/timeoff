"use strict";

const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;

describe("User-facing error messages", function() {
  it("does not expose raw deletion exceptions to administrators", function() {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/users/index.js"),
      "utf8"
    );
    const en = JSON.parse(fs.readFileSync(
      path.join(__dirname, "../../../public/locales/en/translation.json"),
      "utf8"
    ));
    const ru = JSON.parse(fs.readFileSync(
      path.join(__dirname, "../../../public/locales/ru/translation.json"),
      "utf8"
    ));

    expect(routeSource).to.contain(
      "req.session.flash_error(req.t('users.messages.removeFailed'))"
    );
    expect(en.users.messages.removeFailed).to.equal("Failed to remove user.");
    expect(ru.users.messages.removeFailed).to.equal("Не удалось удалить пользователя.");
  });

  it("requires employee first and last names on the server", function() {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/users/index.js"),
      "utf8"
    );

    expect(routeSource).to.contain("users.validation.nameRequired");
    expect(routeSource).to.contain("users.validation.lastNameRequired");
  });

  it("does not dereference a missing company while handling delete errors", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/route/settings.js"),
      "utf8"
    );

    expect(source).to.contain("company ? company.id : 'unavailable'");
  });

  it("removes company data inside one transaction", function() {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../lib/model/company/remover.js"),
      "utf8"
    );

    expect(source).to.contain("Models.sequelize.transaction");
    expect(source).to.contain("company.destroy({transaction})");
  });
});
