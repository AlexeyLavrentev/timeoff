"use strict";

const express = require('express'),
  router = express.Router(),
  validator = require('validator'),
  Promise = require('bluebird'),
  moment = require('moment'),
  EmailTransport = require('../email'),
  timeBalance = require('../model/time_balance');

const { sorter } = require('../util');

const normalizeUserList = users => users
  .filter((user, index, arr) => arr.findIndex(item => String(item.id) === String(user.id)) === index)
  .sort((a, b) => sorter(a.lastname, b.lastname));

const getSignedBalance = entries => entries.reduce((memo, entry) => (
  memo + (entry.is_approved() ? entry.signed_hours() : 0)
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
  let wasCreated = false;

  if ([model.TimeBalanceEntry.entry_type_time_off(), model.TimeBalanceEntry.entry_type_worked_extra()].indexOf(entry_type) === -1) {
    req.session.flash_error(req.t('timeBalance.messages.entryTypeInvalid'));
  }

  if (!validator.isFloat(hours) || Number(hours) <= 0 || Number(hours) > 24) {
    req.session.flash_error(req.t('timeBalance.messages.hoursInvalid'));
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
      return entry && (new EmailTransport()).promise_time_balance_request_emails({entry});
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
        return entry && (new EmailTransport()).promise_time_balance_decision_email({
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
