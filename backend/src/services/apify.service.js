'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_instagram.json');
// post-performance-v2 (P3, P11): scrapePostEngagement and its mocks/apify_engagement.json are gone —
// campaign post links are read by postStats.service through the item 3b runner (run id + cost).

// Apify API base
const APIFY_BASE = 'https://api.apify.com/v2';

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

  console.log(`[APIFY] Scraping profile for @${instagramHandle}...`);

  const input = {
    usernames: [instagramHandle],
    resultsType: 'details',
    resultsLimit: 1,
  };

  const items = await _runActor('apify~instagram-scraper', input);
  if (!items || items.length === 0) {
    throw new Error(`Apify returned no data for @${instagramHandle}`);
  }

  const raw = items[0];
  console.log(`[APIFY] Profile scraped: @${instagramHandle} — ${raw.followersCount || 0} followers`);
  return normalise(raw);
}

// ─── Normalisation ──────────────────────────────────────────────────────────

/**
 * Field names vary between Apify actors and between actor versions — the engagement
 * normaliser below has handled that for a while and the profile one never did. It read
 * exactly two spellings and fell through to 0 for everything else, so a shape it did not
 * recognise was stored as a creator with no audience. `null` is the honest value for
 * "the scrape came back and we could not read a number out of it": the admin screens
 * render it as never-measured, whereas a 0 claims we looked and found nobody.
 * Contract: features/admin-creator-review-completeness
 */
function firstNumber(...candidates) {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalise(raw) {
  return {
    followers_count: firstNumber(
      raw.followersCount, raw.followers_count, raw.followers,
      raw.subscribersCount, raw.edge_followed_by?.count
    ),
    engagement_rate: firstNumber(
      raw.engagementRate, raw.engagement_rate, raw.engagement
    ),
    niche: raw.niche || [],
    scrape_data: raw,
  };
}

// ─── Apify API Helper ───────────────────────────────────────────────────────

/**
 * Run an Apify actor and wait for results.
 * Uses the synchronous run-sync-get-dataset-items endpoint which:
 * - Starts the actor
 * - Waits for it to finish (up to timeout)
 * - Returns the dataset items directly
 * All in one HTTP call — no polling needed.
 *
 * @param {string} actorId  e.g. 'apify~instagram-post-scraper' (use ~ not /)
 * @param {object} input    Actor input JSON
 * @returns {Array} Array of result items
 */
async function _runActor(actorId, input) {
  const token = env.APIFY_TOKEN;
  if (!token) {
    throw new Error('APIFY_TOKEN is not configured. Set it in environment variables.');
  }

  // Use the sync endpoint: starts actor, waits for finish, returns items
  // Timeout: 120 seconds (Apify default max for sync is 300s)
  // post-performance-v2 (E26): the token travels in the Authorization header, never in the URL.
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?timeout=120`;

  console.log(`[APIFY] Calling sync endpoint for ${actorId}...`);
  console.log(`[APIFY] Input:`, JSON.stringify(input));

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 180000); // 3 min client timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(fetchTimeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[APIFY] Actor call failed (HTTP ${res.status}):`, errText.substring(0, 500));
      throw new Error(`Apify call failed (HTTP ${res.status}): ${errText.substring(0, 200)}`);
    }

    const items = await res.json();

    if (!Array.isArray(items)) {
      console.error('[APIFY] Unexpected response format:', JSON.stringify(items).substring(0, 300));
      throw new Error('Apify returned unexpected response format (expected array)');
    }

    console.log(`[APIFY] Got ${items.length} items from ${actorId}`);
    return items;
  } catch (e) {
    clearTimeout(fetchTimeout);
    if (e.name === 'AbortError') {
      throw new Error('Apify request timed out after 3 minutes');
    }
    throw e;
  }
}

module.exports = { scrapeProfile };
