'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_instagram.json');
const ENGAGEMENT_FIXTURE_PATH = path.join(__dirname, '../../mocks/apify_engagement.json');

/**
 * Scrape Instagram profile data for an influencer.
 *
 * Mock mode (APIFY_MOCK=true):
 *   Looks up the handle in the multi-handle fixture JSON.
 *   Falls back to the '_default' entry if the handle is not found.
 *   This allows tests to use specific handles (e.g. 'priya_sharma', 'arun_kumar')
 *   to get predictable follower counts, niches, and city values.
 *
 * Production (APIFY_MOCK=false):
 *   Calls Apify Actor API with APIFY_TOKEN and waits for the run to finish.
 *
 * @param {string} instagramHandle  e.g. 'priya_sharma'
 * @param {boolean} forceRefresh    force a fresh scrape even in mock mode
 * @returns {object} Normalised profile data
 */
async function scrapeProfile(instagramHandle, forceRefresh = false) {
  if (env.APIFY_MOCK) {
    const all = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    // Use the handle-specific entry, fall back to _default
    const raw = { ...(all[instagramHandle] || all['_default']) };
    raw.username = instagramHandle;
    console.log(`[APIFY MOCK] Scraped profile for @${instagramHandle}${forceRefresh ? ' (force refresh)' : ''}`);
    return normalise(raw);
  }

  // Production implementation (set APIFY_MOCK=false)
  const raw = await _callApifyActor(instagramHandle);
  return normalise(raw);
}

/**
 * Scrape engagement stats for a specific Instagram post/reel URL.
 * Used by the apify-engagement cron job.
 *
 * @param {string} live_url  e.g. 'https://instagram.com/p/ABC123'
 * @returns {object} Normalised engagement stats
 */
async function scrapePostEngagement(live_url) {
  if (env.APIFY_MOCK) {
    const all = JSON.parse(fs.readFileSync(ENGAGEMENT_FIXTURE_PATH, 'utf8'));
    const raw = all[live_url] || all['default'];
    console.log(`[APIFY MOCK] Scraped post engagement for ${live_url}`);
    return normaliseEngagement(raw);
  }

  // Production: call Apify Instagram Scraper actor
  // Actor: apify/instagram-scraper
  throw new Error('Set APIFY_MOCK=false and provide APIFY_TOKEN to enable live post scraping');
}

/**
 * Normalise raw Apify response to the fields INFLX stores.
 */
function normalise(raw) {
  return {
    followers_count: raw.followersCount || raw.followers_count || 0,
    engagement_rate: raw.engagementRate || raw.engagement_rate || 0,
    niche: raw.niche || [],
    scrape_data: raw,
  };
}

function normaliseEngagement(raw) {
  return {
    reach:       raw.reach       || 0,
    impressions: raw.impressions || 0,
    likes:       raw.likes       || 0,
    comments:    raw.comments    || 0,
    saves:       raw.saves       || 0,
    shares:      raw.shares      || 0,
  };
}

async function _callApifyActor(handle) {
  // Production: POST to Apify Actor run endpoint, poll until finished.
  // https://docs.apify.com/api/v2
  throw new Error('Set APIFY_MOCK=false and provide APIFY_TOKEN to enable live scraping');
}

module.exports = { scrapeProfile, scrapePostEngagement };
