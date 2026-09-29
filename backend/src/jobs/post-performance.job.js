'use strict';

/**
 * post-performance.job.js — every hour, each post's results across all shoppers (seen, opens, shop
 * taps, saves, likes, finished videos) and its smoothed score. Read only by the learning feed
 * (rules v1.7 §5.12 Stage B), which stays off until INFLX switches it on.
 * Contract: features/follower-app-v2
 */

const feed = require('../services/shopperFeed.service');

async function run() {
  try {
    return await feed.refreshPerformance();
  } catch (e) {
    console.error('[CRON post-performance] failed:', e.message);
    return { posts: 0 };
  }
}

module.exports = { run };
