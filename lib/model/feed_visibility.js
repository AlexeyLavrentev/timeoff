'use strict';

const { getCommentsForLeave } = require('./comment');
const { doesUserHasExtendedViewOfLeave } = require('./leave');

const getVisibleCommentsForFeed = async ({
  actingUser,
  leave,
  canViewExtended = doesUserHasExtendedViewOfLeave,
  fetchComments = getCommentsForLeave,
}) => {
  const canViewComments = await canViewExtended({
    user: actingUser,
    leave,
  });

  if (!canViewComments) {
    return [];
  }

  return fetchComments({leave});
};

module.exports = {
  getVisibleCommentsForFeed,
};
