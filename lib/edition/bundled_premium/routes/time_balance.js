"use strict";

const express = require('express'),
  router = express.Router(),
  validator = require('../../../util/validator'),
  Promise = require('bluebird'),
  moment = require('moment'),
  premiumEmail = require('../email_transport'),
  timeBalance = require('../models/time_balance');

const { sorter } = require('../../../util');

const REASONS = [
  'family_time_off',
  'overtime_compensation',
  'weekend_compensation',
  'hr_adjustment',
];

const normalizeUserList = users => users
  .filter((user, index, arr) => arr.findIndex(item => String(item.id) === String(user.id)) === index)
  .sort((a, b) => sorter(a.lastname, b.lastname));

const getSignedBalance = entries => entries.reduce((memo, entry) => (
  memo + (entry.is_approved() && !entry.is_expired() ? entry.signed_hours() : 0)
), 0);

const findEntryWithDetails = ({model, where}) => model.TimeBalanceEntry.findOne({
  where,
  include : [
    {
      model : model.User,
      as : 'user',
      include : [{
        model : model.Department,
        as : 'department',
        include : [{ model : model.User, as : 'boss' }],
      }],
    },
    { model : model.User, as : 'approver' },
  ],
});

router.get('/', function(req, res){
  const model = req.app.get('db_model');

  let manageableUsers;

  req.user.promise_users_I_can_manage()
    .then(users => {
      manageableUsers = normalizeUserList(users);
      const manageableUserIds = manageableUsers.map(user => user.id);

      return Promise.join(
        model.TimeBalanceEntry.findAll({
          where : {
            companyId : req.user.companyId,
            userId : req.user.id,
          },
          include : [
            { model : model.User, as : 'user' },
            { model : model.User, as : 'approver' },
          ],
          order : [['date', 'DESC'], ['createdAt', 'DESC']],
        }),
        timeBalance.promise_pending_entries_for({model, actingUser : req.user}),
        model.TimeBalanceEntry.findAll({
          where : {
            companyId : req.user.companyId,
            userId : manageableUserIds,
            status : model.TimeBalanceEntry.status_approved(),
          },
          include : [{ model : model.User, as : 'user' }],
        }),
        (myEntries, pendingEntries, approvedEntries) => ({
          myEntries,
          pendingEntries,
          approvedEntries,
        })
      );
    })
    .then(({myEntries, pendingEntries, approvedEntries}) => {
      const approvedByUser = approvedEntries.reduce((memo, entry) => {
        const userId = String(entry.userId);
        memo[userId] = memo[userId] || [];
        memo[userId].push(entry);
        return memo;
      }, {});

      const balances = manageableUsers.map(user => ({
        user,
        hours : getSignedBalance(approvedByUser[String(user.id)] || []),
      }));

      res.render('time_balance', {
        title : req.t('timeBalance.title'),
        manageableUsers,
        myEntries,
        pendingEntries,
        balances,
        entryTypeTimeOff : model.TimeBalanceEntry.entry_type_time_off(),
        entryTypeWorkedExtra : model.TimeBalanceEntry.entry_type_worked_extra(),
        reasons : REASONS,
      });
    })
    .catch(error => {
      console.error('Failed to load time balance page: ' + error);
      req.session.flash_error(req.t('timeBalance.messages.loadFailed'));
      res.redirect_with_session('/');
    });
});

router.post('/create/', function(req, res){
  const model = req.app.get('db_model');
  const entry_type = validator.trim(req.body['entry_type'] || '');
  const raw_user_id = validator.trim(req.body['user_id'] || String(req.user.id));
  const hours = validator.trim(req.body['hours'] || '');
  const date = validator.trim(req.body['date'] || '');
  const employee_comment = validator.trim(req.body['employee_comment'] || '');
  const reason = validator.trim(req.body['reason'] || '');
  const reference = validator.trim(req.body['reference'] || '');
  const raw_expires_at = validator.trim(req.body['expires_at'] || '');
  let wasCreated = false;

  if ([model.TimeBalanceEntry.entry_type_time_off(), model.TimeBalanceEntry.entry_type_worked_extra()].indexOf(entry_type) === -1) {
    req.session.flash_error(req.t('timeBalance.messages.entryTypeInvalid'));
  }

  if (!validator.isFloat(hours) || Number(hours) <= 0 || Number(hours) > 24) {
    req.session.flash_error(req.t('timeBalance.messages.hoursInvalid'));
  }

  if (REASONS.indexOf(reason) === -1) {
    req.session.flash_error(req.t('timeBalance.messages.reasonInvalid'));
  }

  if (
    reason === 'family_time_off'
    && entry_type !== model.TimeBalanceEntry.entry_type_time_off()
  ) {
    req.session.flash_error(req.t('timeBalance.messages.reasonTypeMismatch'));
  }

  if (
    ['overtime_compensation', 'weekend_compensation'].indexOf(reason) !== -1
    && entry_type !== model.TimeBalanceEntry.entry_type_worked_extra()
  ) {
    req.session.flash_error(req.t('timeBalance.messages.reasonTypeMismatch'));
  }

  if (reason === 'hr_adjustment' && !req.user.is_admin()) {
    req.session.flash_error(req.t('timeBalance.messages.hrAdjustmentForbidden'));
  }

  let normalizedDate = date;
  try {
    normalizedDate = req.user.company.normalise_date(date);
    if (!validator.isDate(normalizedDate)) {
      throw new Error('Invalid date');
    }
  } catch (error) {
    req.session.flash_error(req.t('timeBalance.messages.dateInvalid'));
  }

  let expires_at = null;
  if (raw_expires_at) {
    try {
      const normalizedExpiresAt = req.user.company.normalise_date(raw_expires_at);
      if (!validator.isDate(normalizedExpiresAt)) {
        throw new Error('Invalid expiration date');
      }
      expires_at = moment.utc(normalizedExpiresAt).format('YYYY-MM-DD');
    } catch (error) {
      req.session.flash_error(req.t('timeBalance.messages.expirationInvalid'));
    }
  }

  if (req.session.flash_has_errors()) {
    return res.redirect_with_session('/time-balance/');
  }

  req.user.promise_users_I_can_manage()
    .then(users => {
      const manageableUsers = normalizeUserList(users);
      const targetUser = manageableUsers.find(user => String(user.id) === String(raw_user_id));

      if (!targetUser) {
        req.session.flash_error(req.t('timeBalance.messages.userInvalid'));
        return null;
      }

      return model.TimeBalanceEntry.create({
        entry_type : entry_type,
        status : model.TimeBalanceEntry.status_new(),
        hours : Number(hours),
        date : moment.utc(normalizedDate).format('YYYY-MM-DD'),
        employee_comment : employee_comment,
        reason : reason,
        reference : reference || null,
        expires_at : expires_at,
        companyId : req.user.companyId,
        userId : targetUser.id,
      });
    })
    .then(entry => entry && findEntryWithDetails({
      model,
      where : { id : entry.id, companyId : req.user.companyId },
    }))
    .then(entry => {
      wasCreated = Boolean(entry);
      const EmailTransport = require('../../../email');
      return entry && premiumEmail.promiseTimeBalanceRequestEmails({
        emailTransport : new EmailTransport(),
        entry,
      });
    })
    .then(() => {
      if (wasCreated) {
        req.session.flash_message(req.t('timeBalance.messages.created'));
      }
      res.redirect_with_session('/time-balance/');
    })
    .catch(error => {
      console.error('Failed to create time balance entry: ' + error);
      req.session.flash_error(req.t('timeBalance.messages.createFailed'));
      res.redirect_with_session('/time-balance/');
    });
});

function entryAction(action, methodName, successKey) {
  return function(req, res) {
    const model = req.app.get('db_model');
    const entryId = validator.trim(req.body['entry_id'] || '');
    const approverComment = validator.trim(req.body['approver_comment'] || '');
    let wasProcessed = false;

    if (!validator.isInt(entryId)) {
      req.session.flash_error(req.t('timeBalance.messages.actionInvalid'));
      return res.redirect_with_session('/time-balance/');
    }

    findEntryWithDetails({
      model,
      where : {
        id : entryId,
        companyId : req.user.companyId,
      },
    })
      .then(entry => {
        if (!timeBalance.canActOnEntry({entry, actingUser : req.user})) {
          req.session.flash_error(req.t('timeBalance.messages.actionForbidden'));
          return null;
        }

        return entry[methodName]({
          by_user : req.user,
          comment : approverComment,
        });
      })
      .then(entry => entry && findEntryWithDetails({
        model,
        where : { id : entry.id, companyId : req.user.companyId },
      }))
      .then(entry => {
        wasProcessed = Boolean(entry);
        const EmailTransport = require('../../../email');
        return entry && premiumEmail.promiseTimeBalanceDecisionEmail({
          emailTransport : new EmailTransport(),
          entry,
          action,
        });
      })
      .then(() => {
        if (wasProcessed) {
          req.session.flash_message(req.t(`timeBalance.messages.${successKey}`));
        }
        res.redirect_with_session('/time-balance/');
      })
      .catch(error => {
        console.error('Failed to ' + action + ' time balance entry: ' + error);
        req.session.flash_error(req.t(`timeBalance.messages.${action}Failed`));
        res.redirect_with_session('/time-balance/');
      });
  };
}

router.post('/approve/', entryAction('approve', 'promise_to_approve', 'approved'));
router.post('/reject/', entryAction('reject', 'promise_to_reject', 'rejected'));

module.exports = router;
