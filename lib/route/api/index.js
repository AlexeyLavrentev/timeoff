
"use strict";

const
  express = require('express'),
  router = express.Router(),
  features = require('../../features'),
  timeBalance = require('../../model/time_balance'),
  vacationPlan = require('../../model/vacation_plan');


const NOTIFICATION_TYPE_PENDING_REQUESTS = 'pending_request';
const NOTIFICATION_TYPE_PENDING_TIME_BALANCE_REQUESTS = 'pending_time_balance_request';
const NOTIFICATION_TYPE_PENDING_VACATION_PLANS = 'pending_vacation_plan';

/**
 *  Factory method that created a notification of given type
 */
const getPendingRequestLabel = ({ t, count, locale, translationKey }) => {
  if (locale === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return t(`notifications.${translationKey}_one`, { count });
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return t(`notifications.${translationKey}_few`, { count });
    }
    return t(`notifications.${translationKey}_many`, { count });
  }

  return t(`notifications.${translationKey}`, { count });
};

const newNotification = ({type, value, t, locale}) => {

  if (type === NOTIFICATION_TYPE_PENDING_REQUESTS) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, locale, translationKey: 'pendingRequest' }),
      link: '/requests/',
    }
  }

  if (type === NOTIFICATION_TYPE_PENDING_TIME_BALANCE_REQUESTS) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, locale, translationKey: 'pendingTimeBalanceRequest' }),
      link: '/time-balance/',
    }
  }

  if (type === NOTIFICATION_TYPE_PENDING_VACATION_PLANS) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, locale, translationKey: 'pendingVacationPlan' }),
      link: '/vacation-plans/',
    }
  }

  return null;
};

router.get('/notifications/', async (req, res) => {
  const actingUser = req.user;

  const data = [];

  try {
    const leaves = await actingUser.promise_leaves_to_be_processed();
    const timeBalanceEntries = features.isEnabled('time_balance')
      ? await timeBalance.promise_pending_entries_for({
        model: req.app.get('db_model'),
        actingUser,
      })
      : [];
    const vacationPlans = features.isEnabled('vacation_planning')
      ? await vacationPlan.promisePendingPlansFor({
        model: req.app.get('db_model'),
        actingUser,
      })
      : [];

    if (leaves.length > 0) {
      data.push(newNotification({
        type: NOTIFICATION_TYPE_PENDING_REQUESTS,
        value: leaves.length,
        t: req.t,
        locale: req.language || 'en',
      }));
    }

    if (timeBalanceEntries.length > 0) {
      data.push(newNotification({
        type: NOTIFICATION_TYPE_PENDING_TIME_BALANCE_REQUESTS,
        value: timeBalanceEntries.length,
        t: req.t,
        locale: req.language || 'en',
      }));
    }

    if (vacationPlans.length > 0) {
      data.push(newNotification({
        type: NOTIFICATION_TYPE_PENDING_VACATION_PLANS,
        value: vacationPlans.length,
        t: req.t,
        locale: req.language || 'en',
      }));
    }

    res.json({data});
  } catch (error) {
    console.log(`Failed to fetch notifications for user [${actingUser.id}]: ${error} at ${error.stack}`);
    res.json({ error: req.t('errors.notificationsFailed') });
  }
});

module.exports = router;
