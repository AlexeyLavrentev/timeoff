'use strict';

const expect = require('chai').expect;
const config = require('../../lib/config');
const models = require('../../../lib/model/db');

describe('Leave summary authorization', function() {
  this.timeout(config.get_execution_timeout());

  const password = 'test123';
  const baseUrl = config.get_application_host();
  const created = {};
  const agents = {};
  let suffix;

  const updateCookies = (cookies, headers) => {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter(Boolean);

    values.forEach(value => {
      const pair = value.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) {
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    });
  };

  const cookieHeader = cookies => Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const login = async user => {
    const cookies = new Map();
    const loginPage = await fetch(`${baseUrl}login/`, {redirect: 'manual'});
    updateCookies(cookies, loginPage.headers);
    const page = await loginPage.text();
    const csrfMatch = page.match(/name=["']_csrf["'][^>]*value=["']([^"']+)/i);
    expect(csrfMatch, 'login page should expose a CSRF token').to.not.equal(null);

    const response = await fetch(`${baseUrl}login/`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'cookie': cookieHeader(cookies),
        'x-csrf-token': csrfMatch[1],
      },
      body: new URLSearchParams({email: user.email, password}).toString(),
    });
    updateCookies(cookies, response.headers);
    expect(response.status).to.equal(302);
    expect(response.headers.get('location')).to.equal('/');

    return {
      get: async path => {
        const summary = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
          redirect: 'manual',
          headers: {cookie: cookieHeader(cookies)},
        });
        return {
          status: summary.status,
          body: await summary.text(),
          contentType: summary.headers.get('content-type'),
        };
      },
    };
  };

  const userValues = (role, company, department, attributes) => Object.assign({
    name: role,
    lastname: `Security-${suffix}`,
    email: `${role.toLowerCase()}-${suffix}@example.test`,
    password: models.User.hashify_password(password),
    companyId: company.id,
    DepartmentId: department.id,
    admin: false,
    activated: true,
  }, attributes);

  const summaryPath = leave => `/calendar/leave-summary/${leave.id}/`;

  before(async function() {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await models.sequelize.authenticate();

    created.companyA = await models.Company.create({
      name: `Security A ${suffix}`,
      country: 'GB',
      start_of_new_year: 1,
    });
    created.companyB = await models.Company.create({
      name: `Security B ${suffix}`,
      country: 'GB',
      start_of_new_year: 1,
    });

    created.departmentA = await models.Department.create({
      name: `Security Alpha ${suffix}`,
      companyId: created.companyA.id,
    });
    created.departmentB = await models.Department.create({
      name: `Security Beta ${suffix}`,
      companyId: created.companyA.id,
    });
    created.departmentC = await models.Department.create({
      name: `Security Gamma ${suffix}`,
      companyId: created.companyA.id,
    });
    created.departmentForeign = await models.Department.create({
      name: `Security Foreign ${suffix}`,
      companyId: created.companyB.id,
    });

    created.admin = await models.User.create(userValues(
      'Admin', created.companyA, created.departmentA, {admin: true}
    ));
    created.hr = await models.User.create(userValues('HR', created.companyA, created.departmentA));
    created.alice = await models.User.create(userValues('Alice', created.companyA, created.departmentA));
    created.bob = await models.User.create(userValues('Bob', created.companyA, created.departmentA));
    created.supervisor = await models.User.create(userValues(
      'Supervisor', created.companyA, created.departmentA
    ));
    created.carol = await models.User.create(userValues('Carol', created.companyA, created.departmentB));
    created.dave = await models.User.create(userValues('Dave', created.companyA, created.departmentC));
    created.eve = await models.User.create(userValues('Eve', created.companyB, created.departmentForeign));

    created.hrGroup = await models.Group.create({
      name: `Security HR ${suffix}`,
      companyId: created.companyA.id,
      is_hr_group: true,
    });
    await models.UserGroup.create({userId: created.hr.id, groupId: created.hrGroup.id});
    await models.DepartmentSupervisor.create({
      user_id: created.supervisor.id,
      department_id: created.departmentB.id,
    });

    created.leaveTypeA = await models.LeaveType.create({
      name: `Security Annual ${suffix}`,
      companyId: created.companyA.id,
    });
    created.leaveTypeB = await models.LeaveType.create({
      name: `Security Foreign Type ${suffix}`,
      companyId: created.companyB.id,
    });

    const createLeave = (user, leaveType, dateStart, comment) => models.Leave.create({
      userId: user.id,
      approverId: user.companyId === created.companyA.id ? created.admin.id : created.eve.id,
      leaveTypeId: leaveType.id,
      date_start: dateStart,
      date_end: dateStart,
      status: models.Leave.status_approved(),
      employee_comment: comment,
    });

    created.aliceLeave = await createLeave(
      created.alice, created.leaveTypeA, '2031-03-11', `Alice private ${suffix}`
    );
    created.bobLeave = await createLeave(
      created.bob, created.leaveTypeA, '2031-03-21', `Bob private ${suffix}`
    );
    created.carolLeave = await createLeave(
      created.carol, created.leaveTypeA, '2031-04-12', `Carol private ${suffix}`
    );
    created.daveLeave = await createLeave(
      created.dave, created.leaveTypeA, '2031-05-13', `Dave private ${suffix}`
    );
    created.eveLeave = await createLeave(
      created.eve, created.leaveTypeB, '2031-06-14', `Eve private ${suffix}`
    );

    created.aliceComment = `Alice secret comment ${suffix}`;
    created.carolComment = `Carol secret comment ${suffix}`;
    await models.Comment.create({
      entityType: models.Comment.getEntityTypeLeave(),
      entityId: created.aliceLeave.id,
      comment: created.aliceComment,
      companyId: created.companyA.id,
      byUserId: created.alice.id,
    });
    await models.Comment.create({
      entityType: models.Comment.getEntityTypeLeave(),
      entityId: created.carolLeave.id,
      comment: created.carolComment,
      companyId: created.companyA.id,
      byUserId: created.carol.id,
    });

    for (const role of ['admin', 'hr', 'alice', 'bob', 'supervisor', 'dave']) {
      agents[role] = await login(created[role]);
    }
  });

  after(async function() {
    await models.Comment.destroy({where: {companyId: [created.companyA.id, created.companyB.id]}});
    await models.Leave.destroy({where: {id: [
      created.aliceLeave.id,
      created.bobLeave.id,
      created.carolLeave.id,
      created.daveLeave.id,
      created.eveLeave.id,
    ]}});
    await models.DepartmentSupervisor.destroy({where: {user_id: created.supervisor.id}});
    await models.UserGroup.destroy({where: {groupId: created.hrGroup.id}});
    await models.Group.destroy({where: {id: created.hrGroup.id}});
    await models.User.destroy({where: {id: [
      created.admin.id,
      created.hr.id,
      created.alice.id,
      created.bob.id,
      created.supervisor.id,
      created.carol.id,
      created.dave.id,
      created.eve.id,
    ]}});
    await models.Department.destroy({where: {id: [
      created.departmentA.id,
      created.departmentB.id,
      created.departmentC.id,
      created.departmentForeign.id,
    ]}});
    await models.LeaveType.destroy({where: {id: [created.leaveTypeA.id, created.leaveTypeB.id]}});
    await models.Company.destroy({where: {id: [created.companyA.id, created.companyB.id]}});
  });

  it('allows an ordinary user to view self and same-department summaries', async function() {
    const self = await agents.alice.get(summaryPath(created.aliceLeave));
    const peer = await agents.alice.get(summaryPath(created.bobLeave));

    expect(self.status).to.equal(200);
    expect(peer.status).to.equal(200);
    expect(peer.body).to.contain('2031-03-21');
    expect(peer.body).to.contain(created.bob.full_name());
    expect(peer.body).to.not.contain(created.leaveTypeA.name);
    expect(peer.body).to.not.contain('Approved');
    expect(peer.body).to.not.contain(created.aliceComment);
  });

  it('makes unrelated, cross-company, and missing denials indistinguishable', async function() {
    const unrelated = await agents.alice.get(summaryPath(created.carolLeave));
    const crossCompany = await agents.alice.get(summaryPath(created.eveLeave));
    const missing = await agents.alice.get('/calendar/leave-summary/2147483647/');

    [unrelated, crossCompany, missing].forEach(response => {
      expect(response.status).to.equal(404);
      expect(response.body).to.equal(unrelated.body);
      expect(response.contentType).to.equal(unrelated.contentType);
      expect(response.body).to.not.contain(created.carol.full_name());
      expect(response.body).to.not.contain(created.eve.full_name());
      expect(response.body).to.not.contain('2031-04-12');
      expect(response.body).to.not.contain('2031-06-14');
      expect(response.body).to.not.contain(created.leaveTypeA.name);
      expect(response.body).to.not.contain(created.leaveTypeB.name);
      expect(response.body).to.not.contain('Approved');
      expect(response.body).to.not.contain(created.carolComment);
    });
  });

  it('allows a supervisor only for a supervised department with extended content', async function() {
    const supervised = await agents.supervisor.get(summaryPath(created.carolLeave));
    const unrelated = await agents.supervisor.get(summaryPath(created.daveLeave));

    expect(supervised.status).to.equal(200);
    expect(supervised.body).to.contain(created.leaveTypeA.name);
    expect(supervised.body).to.contain('Approved');
    expect(supervised.body).to.contain(created.carol.full_name());
    expect(supervised.body).to.contain('Deducted days');
    expect(supervised.body).to.contain(created.admin.full_name());
    expect(supervised.body).to.contain('Requested on');
    expect(supervised.body).to.contain(created.carolComment);
    expect(unrelated.status).to.equal(404);
  });

  it('allows an admin inside the company but not across companies', async function() {
    const ownCompany = await Promise.all([
      created.aliceLeave,
      created.carolLeave,
      created.daveLeave,
    ].map(leave => agents.admin.get(summaryPath(leave))));
    ownCompany.forEach(response => expect(response.status).to.equal(200));
    expect((await agents.admin.get(summaryPath(created.eveLeave))).status).to.equal(404);
  });

  it('allows HR inside the company but not across companies', async function() {
    const ownCompany = await Promise.all([
      created.aliceLeave,
      created.carolLeave,
      created.daveLeave,
    ].map(leave => agents.hr.get(summaryPath(leave))));
    ownCompany.forEach(response => expect(response.status).to.equal(200));
    expect((await agents.hr.get(summaryPath(created.eveLeave))).status).to.equal(404);
  });

  it('honors share_all_absences only inside the company', async function() {
    await created.companyA.update({share_all_absences: true});

    const sameCompany = await agents.dave.get(summaryPath(created.carolLeave));
    const crossCompany = await agents.dave.get(summaryPath(created.eveLeave));

    expect(sameCompany.status).to.equal(200);
    expect(sameCompany.body).to.contain(created.leaveTypeA.name);
    expect(crossCompany.status).to.equal(404);
  });
});
