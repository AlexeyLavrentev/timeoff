'use strict';

const expect = require('chai').expect;
const { getVisibleCommentsForFeed } = require('../../../lib/model/feed_visibility');

describe('Calendar feed comment visibility', function() {
  it('does not expose comments without extended leave access', async function() {
    let fetchWasCalled = false;
    const comments = await getVisibleCommentsForFeed({
      actingUser: {id: 1},
      leave: {id: 10},
      canViewExtended: async () => false,
      fetchComments: async () => {
        fetchWasCalled = true;
        return [{comment: 'private'}];
      },
    });

    expect(comments).to.deep.equal([]);
    expect(fetchWasCalled).to.equal(false);
  });

  it('includes comments for users with extended leave access', async function() {
    const comments = await getVisibleCommentsForFeed({
      actingUser: {id: 1},
      leave: {id: 10},
      canViewExtended: async () => true,
      fetchComments: async ({leave}) => [{
        comment: `visible-${leave.id}`,
      }],
    });

    expect(comments).to.deep.equal([
      {comment: 'visible-10'},
    ]);
  });
});
