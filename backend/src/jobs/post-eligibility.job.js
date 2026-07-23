'use strict';

/**
 * post-eligibility.job.js — refreshes the eligibility cache for every
 * approved creator post (Post/Concept P4). The test itself is live; this
 * sweep keeps the FEED's cheap filter current and fires the 'post.dark'
 * notification on the >0→0 transition. Every 30 minutes.
 * Contract: features/concept-p4-eligibility/.
 */

const eligibility = require('../services/postEligibility.service');

async function run() {
  try {
    await eligibility.sweep();
  } catch (e) {
    console.error('[post-eligibility.job] sweep failed:', e.message);
  }
}

module.exports = { run };
