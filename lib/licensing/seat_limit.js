'use strict';

const moment = require('moment');
const {Op} = require('sequelize');
const features = require('../features');

const isActiveEndDate = endDate => (
  !endDate || moment.utc(endDate).isSameOrAfter(moment.utc().startOf('day'))
);

const getSeatLimit = () => {
  const status = features.getLicenseStatus();
  return status.valid && Number.isSafeInteger(status.maxActiveUsers)
    ? status.maxActiveUsers
    : null;
};

const createSeatLimitError = limit => {
  const error = new Error('Active user limit of ' + limit + ' has been reached.');
  error.code = 'LICENSE_SEAT_LIMIT_EXCEEDED';
  error.show_to_user = true;
  error.maxActiveUsers = limit;
  error.tom_error = true;
  error.user_error_message = error.message;
  return error;
};

const countActiveUsers = ({User, companyId, transaction}) => User.count({
  where: Object.assign({companyId}, User.get_active_user_filter()),
  transaction,
});

const assertUserSaveWithinLimit = async ({User, user, options}) => {
  const limit = getSeatLimit();
  if (!limit || !isActiveEndDate(user.getDataValue('end_date'))) {
    return;
  }

  const previousEndDate = user._previousDataValues && user._previousDataValues.end_date;
  const previousCompanyId = user._previousDataValues && user._previousDataValues.companyId;
  const wasActiveInCompany = !user.isNewRecord
    && String(previousCompanyId) === String(user.companyId)
    && isActiveEndDate(previousEndDate);

  if (wasActiveInCompany) {
    return;
  }

  const activeCount = await countActiveUsers({
    User,
    companyId: user.companyId,
    transaction: options && options.transaction,
  });

  if (activeCount >= limit) {
    throw createSeatLimitError(limit);
  }
};

const assertBulkSaveWithinLimit = async ({User, users, options}) => {
  const limit = getSeatLimit();
  if (!limit || !users.length) {
    return;
  }

  const transaction = options && options.transaction;
  const groups = users.reduce((result, user) => {
    const companyId = user.companyId;
    result[companyId] = result[companyId] || [];
    result[companyId].push(user);
    return result;
  }, {});

  for (const companyId of Object.keys(groups)) {
    const proposed = groups[companyId];
    const existingIds = proposed.map(user => user.id).filter(Boolean);
    const existing = existingIds.length
      ? await User.findAll({
        attributes: ['id', 'end_date'],
        where: {id: {[Op.in]: existingIds}, companyId},
        transaction,
      })
      : [];
    const existingById = new Map(existing.map(user => [String(user.id), user]));
    const currentCount = await countActiveUsers({User, companyId, transaction});
    let projectedCount = currentCount;

    proposed.forEach(user => {
      const current = existingById.get(String(user.id));
      if (current && isActiveEndDate(current.getDataValue('end_date'))) {
        projectedCount -= 1;
      }
      if (isActiveEndDate(user.getDataValue('end_date'))) {
        projectedCount += 1;
      }
    });

    if (projectedCount > limit) {
      throw createSeatLimitError(limit);
    }
  }
};

module.exports = {
  assertBulkSaveWithinLimit,
  assertUserSaveWithinLimit,
  createSeatLimitError,
  getSeatLimit,
  isActiveEndDate,
};
