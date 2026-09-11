'use strict';

/**
 * Item 3b — the Apify runner the social-numbers pipeline uses.
 * Contract: features/item3b-social-numbers · prompt §3.3
 *
 * Why a third runner and not the two sync helpers already in apify.service.js /
 * youtube.service.js: those call `run-sync-get-dataset-items`, which caps at 120 s, never
 * returns the run id and never returns what the run cost. This one starts the run, polls
 * it, then reads the dataset — so every run is recorded with its Apify run id (idempotency)
 * and its `usageTotalUsd` (the budget guard). The token travels in the Authorization
 * header, never in a URL, so a logged URL can never carry it. Both older helpers stay as
 * they are (founder §4.2).
 *
 * Mock mode (APIFY_MOCK): answers from the fixtures the Step-0 probe saved under
 * tests/fixtures/apify/, chosen by actor + input. Tests may inject their own resolver.
 *
 * A refusal for credit or usage limits is classified as `budget`, never as the creator's
 * technical failure (founder Q6).
 */

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const BASE = 'https://api.apify.com/v2';
const FIXTURES = path.join(__dirname, '../../tests/fixtures/apify');
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

class ApifyRefusedError extends Error {
  constructor(message, status) { super(message); this.name = 'ApifyRefusedError'; this.status = status; this.kind = 'budget'; }
}

function headers() {
  if (!env.APIFY_TOKEN) throw new Error('APIFY_TOKEN is not configured.');
  return { Authorization: `Bearer ${env.APIFY_TOKEN}`, 'Content-Type': 'application/json' };
}

/** Apify's own words when the account has no credit or hit its monthly limit. */
function looksLikeBudgetRefusal(status, text) {
  if (status === 402) return true;
  return /usage limit|monthly usage|insufficient (credit|balance|funds)|exceeded.*(limit|quota)|payment required|out of credit|platform usage/i.test(String(text || ''));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Start an actor, wait for it, read its dataset.
 * @returns {Promise<{runId, status, usageTotalUsd, runTimeSecs, items, statusMessage}>}
 * @throws ApifyRefusedError when Apify refuses the run for credit/limit reasons
 */
async function startAndWait(actor, input, { timeoutSecs = env.SOCIAL_RUN_TIMEOUT_SECS, pollMs = 5000 } = {}) {
  if (env.APIFY_MOCK) return mockRun(actor, input);
  const h = headers();
  const start = await fetch(`${BASE}/acts/${actor}/runs?timeout=${timeoutSecs}`, { method: 'POST', headers: h, body: JSON.stringify(input) });
  const startText = await start.text();
  if (!start.ok) {
    if (looksLikeBudgetRefusal(start.status, startText)) throw new ApifyRefusedError(`Apify refused the run (HTTP ${start.status})`, start.status);
    throw new Error(`Apify start failed (HTTP ${start.status}): ${startText.slice(0, 200)}`);
  }
  let run = JSON.parse(startText).data;
  const deadline = Date.now() + (timeoutSecs + 60) * 1000;
  while (!TERMINAL.has(run.status)) {
    if (Date.now() > deadline) {
      await fetch(`${BASE}/actor-runs/${run.id}/abort`, { method: 'POST', headers: h }).catch(() => {});
      throw new Error(`Apify run ${run.id} did not finish within ${timeoutSecs}s`);
    }
    await sleep(pollMs);
    const r = await fetch(`${BASE}/actor-runs/${run.id}`, { headers: h });
    if (r.ok) run = (await r.json()).data;
  }
  let items = [];
  if (run.defaultDatasetId) {
    const d = await fetch(`${BASE}/datasets/${run.defaultDatasetId}/items?clean=true`, { headers: h });
    if (d.ok) items = await d.json();
  }
  const out = {
    runId: run.id, status: run.status, statusMessage: run.statusMessage || null,
    usageTotalUsd: Number(run.usageTotalUsd || 0), runTimeSecs: run.stats ? Number(run.stats.runTimeSecs || 0) : null,
    items: Array.isArray(items) ? items : [],
  };
  if (run.status !== 'SUCCEEDED') {
    if (looksLikeBudgetRefusal(0, run.statusMessage)) throw Object.assign(new ApifyRefusedError(`Apify run ${run.status}: ${run.statusMessage || ''}`), { run: out });
    throw Object.assign(new Error(`Apify run ${run.status}: ${run.statusMessage || 'no message'}`), { run: out });
  }
  return out;
}

/** What the whole account has used this month, from Apify itself (all INFLX runs, founder Q6). */
async function monthlyUsageUsd() {
  if (env.APIFY_MOCK) return { usd: mockUsage.usd, source: 'mock' };
  const r = await fetch(`${BASE}/users/me/limits`, { headers: headers() });
  if (!r.ok) throw new Error(`Apify limits HTTP ${r.status}`);
  const j = await r.json();
  const d = j.data || {};
  return { usd: Number((d.current && d.current.monthlyUsageUsd) || 0), cap: d.limits && d.limits.maxMonthlyUsageUsd, source: 'apify' };
}

// ── Mock mode ───────────────────────────────────────────────────────────────────
const mockUsage = { usd: 0 };
let mockResolver = null;
let mockRunCounter = 0;
function setMockResolver(fn) { mockResolver = fn; }
function setMockUsage(usd) { mockUsage.usd = usd; }
function loadFixture(name) { return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')); }

/** Default fixture answers: the probe creator, the hand-made private/hidden-likes cases, not-found otherwise. */
function defaultMock(actor, input) {
  const a = String(actor);
  if (/instagram-profile-scraper/.test(a)) {
    const found = loadFixture('instagram-profile.json').concat(loadFixture('instagram-profile-private.json'), [
      { username: 'hidden_likes_creator', fullName: 'Hidden Likes', id: '2', followersCount: 10000, followsCount: 10, postsCount: 20, verified: false, private: false, isBusinessAccount: true, businessCategoryName: 'Creator', url: 'https://www.instagram.com/hidden_likes_creator' },
    ]);
    return (input.usernames || []).map(u => found.find(f => f.username === u && !f.error) || { username: u, url: `https://www.instagram.com/${u}`, error: 'not_found', errorDescription: 'Post does not exist' });
  }
  if (/instagram-post-scraper/.test(a)) {
    const u = (input.username || [])[0];
    if (u === 'hidden_likes_creator') return loadFixture('instagram-posts-all-hidden-likes.json');
    if (u === '_akshayareddyyy') return loadFixture('instagram-posts.json');
    return [];
  }
  if (/youtube-scraper/.test(a)) {
    const url = ((input.startUrls || [])[0] || {}).url || '';
    if (/thischanneldoesnotexist/.test(url) || !/lakkireddyakshayareddy-30/i.test(url)) return loadFixture('youtube-notfound.json');
    if (Number(input.maxResultStreams) > 0) return loadFixture('youtube-streams-none.json');
    if (Number(input.maxResultsShorts) > 0) return loadFixture('youtube-shorts.json');
    if (Number(input.maxResults) === 1) return loadFixture('youtube-channel-1.json');
    return loadFixture('youtube-videos.json');
  }
  return [];
}

async function mockRun(actor, input) {
  const items = mockResolver ? await mockResolver(actor, input) : defaultMock(actor, input);
  if (items && items.__refuse) throw new ApifyRefusedError('mock: usage limit exceeded', 402);
  if (items && items.__fail) throw new Error(items.__fail);
  mockRunCounter += 1;
  return { runId: `mock-${Date.now()}-${mockRunCounter}`, status: 'SUCCEEDED', statusMessage: 'mock', usageTotalUsd: 0, runTimeSecs: 0, items: Array.isArray(items) ? items : [] };
}

module.exports = { startAndWait, monthlyUsageUsd, ApifyRefusedError, looksLikeBudgetRefusal, setMockResolver, setMockUsage, loadFixture, defaultMock };
