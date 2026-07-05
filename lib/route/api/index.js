
"use strict";

const
  express = require('express'),
  router = express.Router(),
  edition = require('../../edition');


const NOTIFICATION_TYPE_PENDING_REQUESTS = 'pending_request';

/**
 *  Factory method that created a notification of given type
 */
const getPendingRequestLabel = ({ t, count, translationKey }) =>
  t(`notifications.${translationKey}`, { count });

const newNotification = ({type, value, t, translationKey, link, badgeId}) => {

  if (type === NOTIFICATION_TYPE_PENDING_REQUESTS) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, translationKey: 'pendingRequest' }),
      link: '/requests/',
    }
  }

  if (translationKey && link) {
    return {
      type,
      numberOfRequests: value,
      label: getPendingRequestLabel({ t, count: value, translationKey }),
      link,
      badgeId,
    }
  }

  return null;
};

router.get('/notifications/', async (req, res) => {
  const actingUser = req.user;

  const data = [];

  try {
    const leaves = await actingUser.promise_leaves_to_be_processed();
    const premiumNotificationProviders = edition.getNotificationProviders();

    if (leaves.length > 0) {
      data.push(newNotification({
        type: NOTIFICATION_TYPE_PENDING_REQUESTS,
        value: leaves.length,
        t: req.t,
      }));
    }

    for (const provider of premiumNotificationProviders) {
      const items = await provider.fetch({
        model: req.app.get('db_model'),
        actingUser,
        req,
      });

      if (items.length > 0) {
        data.push(newNotification({
          type: provider.type,
          value: items.length,
          t: req.t,
          translationKey: provider.translationKey,
          link: provider.link,
          badgeId: provider.badgeId,
        }));
      }
    }

    res.json({data});
  } catch (error) {
    console.log(`Failed to fetch notifications for user [${actingUser.id}]: ${error} at ${error.stack}`);
    res.status(500).json({ error: req.t('errors.notificationsFailed') });
  }
});

module.exports = router;
