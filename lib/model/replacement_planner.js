"use strict";

const Promise = require('bluebird');
const { getUsersWithLeaves } = require('./Report');

const DEFAULT_STATUSES = ['Approved'];

const parseStatuses = ({ rawStatuses }) => {
  if (!rawStatuses) {
    return DEFAULT_STATUSES;
  }

  const statuses = `${rawStatuses}`
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return statuses.length > 0 ? statuses : DEFAULT_STATUSES;
};

const isLeaveMatchingStatus = ({ leave, statuses }) => statuses.indexOf(leave.status) >= 0;

const getReplacementPlan = ({
  company,
  startDate,
  endDate,
  departmentId = null,
  leaveStatuses = DEFAULT_STATUSES,
}) => {
  const dbModel = company.sequelize.models;
  const User = dbModel.User;
  const UserReplacement = dbModel.UserReplacement;

  let result = getUsersWithLeaves({ company, startDate, endDate, departmentId });

  result = result.then(report => report
    .map(entry => ({
      user: entry.user,
      leaves: entry.leaves.filter(leave => isLeaveMatchingStatus({ leave, statuses: leaveStatuses })),
    }))
    .filter(entry => entry.leaves.length > 0)
  );

  result = result.then(absentEntries => {
    const absentUserIds = absentEntries.map(entry => entry.user.id);
    const absentUserIdsSet = absentUserIds.reduce((memo, id) => {
      memo[id] = true;
      return memo;
    }, {});

    if (absentUserIds.length === 0) {
      return Promise.resolve({
        absentEntries,
        replacementRules: [],
        absentUserIdsSet,
      });
    }

    return UserReplacement.findAll({
      where : {
        companyId : company.id,
        userId    : { $in : absentUserIds },
      },
      include : [{
        model : User,
        as    : 'replacement',
        where : {
          companyId : company.id,
          $or : User.get_active_user_filter().$or,
        },
      }],
      order : [
        ['userId', 'ASC'],
        ['priority', 'ASC'],
        [{ model : User, as : 'replacement' }, 'lastname', 'ASC'],
        [{ model : User, as : 'replacement' }, 'name', 'ASC'],
      ],
    })
    .then(replacementRules => ({
      absentEntries,
      replacementRules,
      absentUserIdsSet,
    }));
  });

  result = result.then(({absentEntries, replacementRules, absentUserIdsSet}) => {
    const rulesByUser = replacementRules.reduce((memo, rule) => {
      if (!memo[rule.userId]) {
        memo[rule.userId] = [];
      }

      memo[rule.userId].push(rule);
      return memo;
    }, {});

    const data = absentEntries.map(({user, leaves}) => {
      const rules = rulesByUser[user.id] || [];

      const candidates = rules.map(rule => {
        const replacement = rule.replacement;
        const isAvailable = (
          replacement &&
          replacement.id !== user.id &&
          !absentUserIdsSet[replacement.id]
        );

        return {
          id        : replacement.id,
          email     : replacement.email,
          fullName  : replacement.full_name(),
          priority  : rule.priority,
          available : isAvailable,
        };
      });

      const selected = candidates.find(candidate => candidate.available);

      return {
        user,
        leaves,
        selectedReplacement : selected || null,
        candidates,
      };
    });

    return {
      startDate : startDate.format('YYYY-MM-DD'),
      endDate   : endDate.format('YYYY-MM-DD'),
      leaveStatuses,
      totalAbsentEmployees : data.length,
      data,
    };
  });

  return result;
};

module.exports = {
  getReplacementPlan,
  parseStatuses,
};
