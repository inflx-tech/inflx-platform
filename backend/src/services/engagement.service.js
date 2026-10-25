'use strict';

/**
 * engagement.service.js — the brand website's campaign Analytics tab.
 *
 * post-performance-v2 (P1, P11): the numbers come from proof_stats — the links she hands in at
 * the content step, read on the day curve — not from deliverables.live_url / deliverable_stats,
 * which nothing has written since item 12 retired submit-live. The path stays; the shape is new
 * (E11): { totals:{views,likes,comments,links,linksRead,waiting,updatedAt}, bySet[], byCreator[], links[] }.
 * No engagement rate anywhere (P10). Contract: features/post-performance-v2
 */

const postStats = require('./postStats.service');

async function getCampaignEngagement(campaignId) {
  return postStats.campaignEngagement(campaignId);
}

module.exports = { getCampaignEngagement };
