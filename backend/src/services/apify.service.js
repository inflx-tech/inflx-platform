'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_instagram.json');
const ENGAGEMENT_FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_engagement.json');

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

  console.log(`[APIFY] Scraping post engagement for ${live_url}...`);

  // Use apify/instagram-post-scraper
  // The actor accepts multiple input field names depending on version
  const input = {
    directUrls: [live_url],
    shortcodes: [],
    resultsLimit: 1,
  };

  // Extract shortcode from URL as fallback (e.g. /reel/DUd7Wy0EtCS/ → DUd7Wy0EtCS)
  const shortcodeMatch = live_url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (shortcodeMatch) {
    input.shortcodes = [shortcodeMatch[2]];
  }

  const items = await _runActor('apify~instagram-post-scraper', input);
  if (!items || items.length === 0) {
    throw new Error(`Apify returned no data for URL: ${live_url}`);
  }

  const raw = items[0];
  console.log(`[APIFY] Post scraped:`, JSON.stringify(raw).substring(0, 300));
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
  // Handle all known field name variants from different Apify actors
  return {
    reach:       raw.reach       || raw.reachCount       || 0,
    impressions: raw.impressions || raw.impressionsCount  || raw.videoViewCount || raw.videoPlayCount || raw.viewCount || 0,
    likes:       raw.likes       || raw.likesCount        || 0,
    comments:    raw.comments    || raw.commentsCount     || 0,
    saves:       raw.saves       || raw.savesCount        || 0,
    shares:      raw.shares      || raw.sharesCount       || 0,
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
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120`;

  console.log(`[APIFY] Calling sync endpoint for ${actorId}...`);
  console.log(`[APIFY] Input:`, JSON.stringify(input));

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 180000); // 3 min client timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

module.exports = { scrapeProfile, scrapePostEngagement };
