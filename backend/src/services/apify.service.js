'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_instagram.json');
const ENGAGEMENT_FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_engagement.json');

// Apify API base
const APIFY_BASE = 'https://api.apify.com/v2';

// Actor IDs
const POST_SCRAPER_ACTOR = 'apify/instagram-post-scraper';
const PROFILE_SCRAPER_ACTOR = 'apify/instagram-scraper';

/**
 * Scrape Instagram profile data for an influencer.
 */
async function scrapeProfile(instagramHandle, forceRefresh = false) {
  if (env.APIFY_MOCK) {
    const all = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    const raw = { ...(all[instagramHandle] || all['_default']) };
    raw.username = instagramHandle;
    console.log(`[APIFY MOCK] Scraped profile for @${instagramHandle}${forceRefresh ? ' (force refresh)' : ''}`);
    return normalise(raw);
  }

  // Production: call Apify instagram-scraper for profile data
  console.log(`[APIFY] Scraping profile for @${instagramHandle}...`);

  const input = {
    usernames: [instagramHandle],
    resultsType: 'details',
    resultsLimit: 1,
  };

  const items = await _runActorSync(PROFILE_SCRAPER_ACTOR, input);
  if (!items || items.length === 0) {
    throw new Error(`Apify returned no data for @${instagramHandle}`);
  }

  const raw = items[0];
  console.log(`[APIFY] Profile scraped: @${instagramHandle} — ${raw.followersCount || 0} followers`);
  return normalise(raw);
}

/**
 * Scrape engagement stats for a specific Instagram post/reel URL.
 */
async function scrapePostEngagement(live_url) {
  if (env.APIFY_MOCK) {
    const all = JSON.parse(fs.readFileSync(ENGAGEMENT_FIXTURE_PATH, 'utf8'));
    const raw = all[live_url] || all['default'];
    console.log(`[APIFY MOCK] Scraped post engagement for ${live_url}`);
    return normaliseEngagement(raw);
  }

  // Production: call apify/instagram-post-scraper
  console.log(`[APIFY] Scraping post engagement for ${live_url}...`);

  const input = {
    directUrls: [live_url],
    resultsLimit: 1,
  };

  const items = await _runActorSync(POST_SCRAPER_ACTOR, input);
  if (!items || items.length === 0) {
    throw new Error(`Apify returned no data for URL: ${live_url}`);
  }

  const raw = items[0];
  console.log(`[APIFY] Post scraped: ${live_url} — ${raw.likesCount || raw.likes || 0} likes, ${raw.commentsCount || raw.comments || 0} comments`);
  return normaliseEngagement(raw);
}

// ─── Normalisation ──────────────────────────────────────────────────────────

function normalise(raw) {
  return {
    followers_count: raw.followersCount || raw.followers_count || 0,
    engagement_rate: raw.engagementRate || raw.engagement_rate || 0,
    niche: raw.niche || [],
    scrape_data: raw,
  };
}

function normaliseEngagement(raw) {
  // The apify/instagram-post-scraper returns different field names
  // depending on the actor version. Handle all known variants.
  return {
    reach:       raw.reach       || raw.reachCount       || 0,
    impressions: raw.impressions || raw.impressionsCount  || raw.videoViewCount || raw.videoPlayCount || 0,
    likes:       raw.likes       || raw.likesCount        || 0,
    comments:    raw.comments    || raw.commentsCount     || 0,
    saves:       raw.saves       || raw.savesCount        || 0,
    shares:      raw.shares      || raw.sharesCount       || 0,
  };
}

// ─── Apify API Helpers ──────────────────────────────────────────────────────

/**
 * Run an Apify actor synchronously (waits for completion).
 * Uses the synchronous run endpoint which blocks until the actor finishes
 * (up to 300 seconds by default).
 *
 * @param {string} actorId  e.g. 'apify/instagram-post-scraper'
 * @param {object} input    Actor input JSON
 * @returns {Array} Array of result items from the dataset
 */
async function _runActorSync(actorId, input) {
  const token = env.APIFY_TOKEN;
  if (!token) {
    throw new Error('APIFY_TOKEN is not configured');
  }

  // URL-encode the actor ID (slash → ~)
  const encodedActorId = actorId.replace('/', '~');

  // Step 1: Start actor run
  const runUrl = `${APIFY_BASE}/acts/${encodedActorId}/runs?token=${token}`;

  console.log(`[APIFY] Starting actor ${actorId}...`);

  const runRes = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!runRes.ok) {
    const errText = await runRes.text();
    throw new Error(`Apify actor start failed (HTTP ${runRes.status}): ${errText.substring(0, 200)}`);
  }

  const runData = await runRes.json();
  const runId = runData.data?.id;

  if (!runId) {
    throw new Error('Apify actor start returned no run ID');
  }

  console.log(`[APIFY] Run started: ${runId}, waiting for completion...`);

  // Step 2: Poll for completion (max 5 minutes)
  const maxWait = 300000; // 5 min
  const pollInterval = 3000; // 3 sec
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await _sleep(pollInterval);

    const statusUrl = `${APIFY_BASE}/actor-runs/${runId}?token=${token}`;
    const statusRes = await fetch(statusUrl);

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === 'SUCCEEDED') {
      // Step 3: Fetch dataset items
      const datasetId = statusData.data?.defaultDatasetId;
      if (!datasetId) {
        throw new Error('Apify run succeeded but no dataset ID found');
      }

      const itemsUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}`;
      const itemsRes = await fetch(itemsUrl);

      if (!itemsRes.ok) {
        throw new Error(`Failed to fetch dataset items (HTTP ${itemsRes.status})`);
      }

      const items = await itemsRes.json();
      console.log(`[APIFY] Run ${runId} completed. Got ${items.length} items.`);
      return items;
    }

    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run ${runId} ended with status: ${status}`);
    }

    // Still RUNNING or READY — keep polling
  }

  throw new Error(`Apify run ${runId} timed out after ${maxWait / 1000}s`);
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeProfile, scrapePostEngagement };
