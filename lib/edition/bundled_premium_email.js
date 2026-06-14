'use strict';

const bluebird = require('bluebird');
const branding = require('../branding');

function promiseTimeBalanceRequestEmails({emailTransport, entry}) {
  const requester = entry.get('user');
  const supervisor = requester.department && requester.department.boss;
  const sendMail = emailTransport.get_send_email();

  const sendTo = ({recipient, templateName}) => {
    if (!recipient) {
      return bluebird.resolve();
    }

    return emailTransport.promise_rendered_email_template({
      template_name : templateName,
      context : {
        entry,
        requester,
        supervisor,
        user : recipient,
      },
    })
    .then(email => sendMail({
      from    : branding.getEmailFrom(),
      to      : recipient.email,
      subject : email.subject,
      html    : email.body,
    })
      .then(() => recipient.record_email_addressed_to_me(email))
    );
  };

  return bluebird.join(
    sendTo({recipient : supervisor, templateName : 'time_balance_request_to_supervisor'}),
    sendTo({recipient : requester, templateName : 'time_balance_request_to_requestor'}),
    () => bluebird.resolve()
  );
}

function promiseTimeBalanceDecisionEmail({emailTransport, entry, action}) {
  const requester = entry.get('user');
  const approver = entry.get('approver');
  const sendMail = emailTransport.get_send_email();

  return emailTransport.promise_rendered_email_template({
    template_name : 'time_balance_decision_to_requestor',
    context : {
      entry,
      action,
      requester,
      approver,
      user : requester,
    },
  })
  .then(email => sendMail({
    from    : branding.getEmailFrom(),
    to      : requester.email,
    subject : email.subject,
    html    : email.body,
  })
    .then(() => requester.record_email_addressed_to_me(email))
  );
}

module.exports = {
  promiseTimeBalanceDecisionEmail,
  promiseTimeBalanceRequestEmails,
};
