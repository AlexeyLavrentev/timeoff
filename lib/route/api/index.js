
"use strict";

const
  express = require('express'),
  router = express.Router();


const NOTIFICATION_TYPE_PENDING_REQUESTS = 'pending_request';

/**
 *  Factory method that created a notification of given type
 */
const getPendingRequestLabel = ({ t, count, locale }) => {
  if (locale === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return t('notifications.pendingRequest_one', { count });
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return t('notifications.pendingRequest_few', { count });
    }
    return t('notifications.pendingRequest_many', { count });
  }

  return t('notifications.pendingRequest', { count });
};

const newNotification = ({type, value, t, locale}) => {

  if (type === NOTIFICATION_TYPE_PENDING_REQUESTS) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, locale }),
      link: '/requests/',
    }
  }

  return null;
};

router.get('/notifications/', async (req, res) => {
  const actingUser = req.user;

  const data = [];

  try {
    const leaves = await actingUser.promise_leaves_to_be_processed();

    if (leaves.length > 0) {
      data.push(newNotification({
        type: NOTIFICATION_TYPE_PENDING_REQUESTS,
        value: leaves.length,
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
