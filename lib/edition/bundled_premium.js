'use strict';

const path = require('path');
const features = require('../features');

function registerRoutes(registry) {
  registry.registerRoute({
    name       : 'time-balance',
    path       : '/time-balance/',
    middleware : [features.requireFeature('time_balance')],
    router     : require('../route/time_balance'),
  });

  registry.registerRoute({
    name       : 'vacation-plans',
    path       : '/vacation-plans/',
    middleware : [features.requireFeature('vacation_planning')],
    router     : require('../route/vacation_plans'),
  });
}

function registerNavigation(registry) {
  registry.registerNavigationItem({
    feature  : 'time_balance',
    name     : 'time-balance',
    path     : '/time-balance/',
    labelKey : 'nav.timeBalance',
    location : 'primary',
    badgeId  : 'time-balance-nav-badge',
    order    : 10,
  });

  registry.registerNavigationItem({
    feature  : 'vacation_planning',
    name     : 'vacation-plans',
    path     : '/vacation-plans/',
    labelKey : 'nav.vacationPlans',
    location : 'primary',
    order    : 20,
  });
}

function registerNotifications(registry) {
  registry.registerNotificationProvider({
    feature        : 'time_balance',
    type           : 'pending_time_balance_request',
    translationKey : 'pendingTimeBalanceRequest',
    link           : '/time-balance/',
    order          : 10,
    fetch          : function({model, actingUser}) {
      return require('../model/time_balance').promise_pending_entries_for({
        model,
        actingUser,
      });
    },
  });

  registry.registerNotificationProvider({
    feature        : 'vacation_planning',
    type           : 'pending_vacation_plan',
    translationKey : 'pendingVacationPlan',
    link           : '/vacation-plans/',
    order          : 20,
    fetch          : function({model, actingUser}) {
      return require('../model/vacation_plan').promisePendingPlansFor({
        model,
        actingUser,
      });
    },
  });
}

function register({registry}) {
  registry.registerViewPath(path.join(__dirname, '..', '..', 'views'));
  registerRoutes(registry);
  registerNavigation(registry);
  registerNotifications(registry);

  return {
    name: 'bundled-premium',
  };
}

module.exports = {
  register,
};
