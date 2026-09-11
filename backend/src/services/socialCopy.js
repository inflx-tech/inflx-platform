'use strict';

/**
 * Item 3b — every message the social-numbers rules produce, word for word (prompt §6).
 * The apps mirror these in Packages/Mobile/src/components/social/copy3b.js.
 * Contract: features/item3b-social-numbers
 */
const MSG = {
  INSTAGRAM_INVALID: 'Enter a valid Instagram username.',
  YOUTUBE_INVALID: 'Enter a YouTube handle or channel link.',
  AT_LEAST_ONE: 'Add at least one account.',
  LAST_ACCOUNT: 'Keep at least one account.',
  CHECK_AGAIN_LIMIT: 'You can check again once a day.',
  CHECK_AGAIN_NOT_ALLOWED: 'Check again is only for a private or failing account.',
};

module.exports = { MSG };
