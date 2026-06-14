'use strict';

var expect = require('chai').expect;
var premiumEmail = require('../../lib/edition/bundled_premium_email');

describe('Bundled premium email helpers', function() {
  function createRecipient(email) {
    return {
      email: email,
      recorded: [],
      record_email_addressed_to_me: function(renderedEmail) {
        this.recorded.push(renderedEmail);
        return Promise.resolve();
      },
    };
  }

  function createEmailTransport(sent, rendered) {
    return {
      get_send_email: function() {
        return function(message) {
          sent.push(message);
          return Promise.resolve();
        };
      },
      promise_rendered_email_template: function(args) {
        rendered.push(args);
        return Promise.resolve({
          subject: 'Rendered ' + args.template_name,
          body: '<p>' + args.template_name + '</p>',
        });
      },
    };
  }

  it('sends time balance request emails to supervisor and requester', async function() {
    var supervisor = createRecipient('boss@example.com');
    var requester = createRecipient('employee@example.com');
    var sent = [];
    var rendered = [];
    var entry = {
      get: function(key) {
        if (key === 'user') {
          return {
            department: {boss: supervisor},
            email: requester.email,
            record_email_addressed_to_me: requester.record_email_addressed_to_me.bind(requester),
          };
        }
      },
    };

    await premiumEmail.promiseTimeBalanceRequestEmails({
      emailTransport: createEmailTransport(sent, rendered),
      entry: entry,
    });

    expect(rendered.map(function(args) { return args.template_name; }))
      .to.deep.equal(['time_balance_request_to_supervisor', 'time_balance_request_to_requestor']);
    expect(sent.map(function(message) { return message.to; }))
      .to.deep.equal(['boss@example.com', 'employee@example.com']);
    expect(supervisor.recorded.length).to.equal(1);
    expect(requester.recorded.length).to.equal(1);
  });

  it('sends time balance decision email to requester', async function() {
    var requester = createRecipient('employee@example.com');
    var approver = createRecipient('boss@example.com');
    var sent = [];
    var rendered = [];
    var entry = {
      get: function(key) {
        if (key === 'user') {
          return requester;
        }
        if (key === 'approver') {
          return approver;
        }
      },
    };

    await premiumEmail.promiseTimeBalanceDecisionEmail({
      emailTransport: createEmailTransport(sent, rendered),
      entry: entry,
      action: 'approve',
    });

    expect(rendered[0].template_name).to.equal('time_balance_decision_to_requestor');
    expect(rendered[0].context.action).to.equal('approve');
    expect(sent[0].to).to.equal('employee@example.com');
    expect(requester.recorded.length).to.equal(1);
  });
});
