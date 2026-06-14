"use strict";

const canActOnEntry = ({entry, actingUser}) => {
  if (!entry || !entry.is_new() || !entry.user || !entry.user.department) {
    return false;
  }

  if (String(entry.userId) === String(actingUser.id)) {
    return false;
  }

  return actingUser.is_admin()
    || String(entry.user.department.bossId) === String(actingUser.id);
};

const promise_pending_entries_for = ({model, actingUser}) => model.TimeBalanceEntry.findAll({
  where : {
    companyId : actingUser.companyId,
    status : model.TimeBalanceEntry.status_new(),
  },
  include : [
    { model : model.User, as : 'user', include : [{ model : model.Department, as : 'department' }] },
    { model : model.User, as : 'approver' },
  ],
  order : [['createdAt', 'ASC']],
})
.then(entries => entries.filter(entry => canActOnEntry({entry, actingUser})));

module.exports = {
  canActOnEntry,
  promise_pending_entries_for,
};
