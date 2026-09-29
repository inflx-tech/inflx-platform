'use strict';

/**
 * shoppable-posts-v2 — daily: an offer whose end date has passed takes every post using it out of
 * the shop, and each creator is told (rules 4.9, P15). Ending an offer early does the same at once
 * (offerLife.endNow); reads already treat a passed end date as removed, so this only makes it
 * permanent and sends the notice. Idempotent: only submitted/approved posts are touched.
 * Contract: features/shoppable-posts-v2 · spec D15
 */

const posts = require('../services/shoppablePosts.service');

async function run({ today } = {}) {
  try {
    const r = await posts.sweepEndedOffers(today);
    if (r.posts) console.log(`[CRON posts-offer-ended] ${r.offers} offer(s) ended, ${r.posts} post(s) left the shop.`);
    return r;
  } catch (e) {
    console.error('[CRON posts-offer-ended] failed:', e.message);
    return { offers: 0, posts: 0 };
  }
}

module.exports = { run };
