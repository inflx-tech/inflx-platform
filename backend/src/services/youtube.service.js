'use strict';

/**
 * YouTube channel figures for a creator, via Apify — the same scraper the Instagram side
 * already uses. Founder, 2026-08-26: "what we are doing for youtube and instagram data is
 * using apify scraper for now so we dont want any youtube api for now."
 *
 * A creator is asked for a YouTube channel at signup and, until this file existed,
 * nothing ever read it back. The admin reviewing a YouTube-first creator saw her
 * Instagram numbers — 0 followers, 0.00% engagement — with no way to tell that apart
 * from a creator with no audience. Contract: features/admin-creator-review-completeness
 *
 * When APIFY_TOKEN is absent every call returns { configured: false } and the caller is
 * expected to say so on screen. It must never fall through to zeroes — a confident 0
 * subscribers is the exact failure this contract exists to fix.
 */

const fs   = require('fs');
const path = require('path');
const env  = require('../config/env');

const FIXTURE_PATH = path.join(__dirname, '../../mocks/youtube_channels.json');

/**
 * Reduce whatever the creator typed to a bare handle or channel id.
 *
 * Creators paste all of these, and every one of them has been seen in a signup field:
 *   MrBeast · @MrBeast · youtube.com/@MrBeast · https://www.youtube.com/c/MrBeast
 *   youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA · youtube.com/user/nigahiga
 *
 * @returns {{kind:'id'|'handle'|'legacy', value:string} | null}
 */
function parseChannelRef(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Strip a pasted URL down to its path.
  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i);
  if (urlMatch) s = urlMatch[1];
  s = s.split(/[?#]/)[0].replace(/\/+$/, '');

  // /channel/UC… — the only form that is already a channel id.
  const chan = s.match(/^channel\/(UC[\w-]{20,})$/i);
  if (chan) return { kind: 'id', value: chan[1] };

  // A bare channel id, pasted without the /channel/ prefix.
  if (/^UC[\w-]{20,}$/.test(s)) return { kind: 'id', value: s };

  // /user/<name> and /c/<name> are the pre-handle forms. Both still resolve as URLs,
  // so they are kept distinct only so the right URL shape is rebuilt below.
  const legacy = s.match(/^(?:user|c)\/([^/]+)$/i);
  if (legacy) return { kind: 'legacy', value: legacy[1] };

  // Everything else is a handle, with or without the @.
  const handle = s.replace(/^@+/, '').split('/')[0];
  return handle ? { kind: 'handle', value: handle } : null;
}

/** The URL a human should click to see this channel. */
function channelUrl(raw) {
  const ref = parseChannelRef(raw);
  if (!ref) return null;
  if (ref.kind === 'id') return `https://www.youtube.com/channel/${ref.value}`;
  return `https://www.youtube.com/@${ref.value}`;
}

/**
 * Numbers come back from Apify in every shape a YouTube page renders them in:
 * 8120, "8120", "8,120", "8.12K subscribers", "1.2M", "1,830,000 views".
 * Anything unreadable is null — never 0.
 */
function toCount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;

  const s = String(value).trim().replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!m) return null;

  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(n * mult);
}

/** First readable count across a list of candidate fields. */
function firstCount(...candidates) {
  for (const c of candidates) {
    const n = toCount(c);
    if (n != null) return n;
  }
  return null;
}

/**
 * Fetch the channel behind a handle / id / URL.
 *
 * @returns {Promise<{
 *   configured: boolean, found: boolean, reason?: string,
 *   channel_id?: string, title?: string, subscribers?: number|null,
 *   views?: number|null, videos?: number|null, thumbnail_url?: string|null,
 *   raw?: object
 * }>}
 */
async function fetchChannel(rawHandle) {
  const ref = parseChannelRef(rawHandle);
  if (!ref) return { configured: true, found: false, reason: 'No YouTube channel on file' };

  if (env.APIFY_MOCK) {
    // Same switch the Instagram path uses, so a local run is never silently half-live.
    let all = {};
    try { all = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')); } catch { /* no fixture */ }
    const raw = all[ref.value.toLowerCase()] || all['_default'];
    if (!raw) return { configured: true, found: false, reason: 'No fixture for this channel' };
    console.log(`[YOUTUBE MOCK] Channel ${ref.kind}=${ref.value}`);
    return { configured: true, found: true, ...normalise(raw) };
  }

  if (!env.APIFY_TOKEN) {
    return {
      configured: false,
      found: false,
      reason: 'APIFY_TOKEN is not set — YouTube figures cannot be checked',
    };
  }

  const url = channelUrl(rawHandle);
  console.log(`[APIFY] Scraping YouTube channel ${url}...`);

  // One video is enough. Every actor in this family attaches the channel's own totals
  // (subscribers, lifetime views, video count) to each video item, so pulling a single
  // result is the cheapest way to read the channel — and this is a per-run charge, so
  // asking for more would cost more for nothing.
  const input = {
    startUrls: [{ url }],
    maxResults: 1,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  };

  const items = await _runActor(env.APIFY_YOUTUBE_ACTOR, input);
  if (!items || items.length === 0) {
    return { configured: true, found: false, reason: `Apify returned no data for ${url}` };
  }

  const raw = items[0];
  const out = normalise(raw);
  console.log(`[APIFY] YouTube scraped: ${url} — ${out.subscribers ?? 'no'} subscribers`);
  return { configured: true, found: true, ...out };
}

/**
 * Actor output shapes differ between YouTube actors and between versions of the same one,
 * and newer builds nest the channel totals under `aboutChannelInfo`. Reading a fixed pair
 * of field names is what made the Instagram normaliser store an unrecognised shape as a
 * creator with no audience — so this reads every known spelling and returns null, not 0,
 * when none of them are present.
 */
function normalise(item) {
  const about = item.aboutChannelInfo || item.channelInfo || {};
  const pick  = (...keys) => {
    for (const k of keys) {
      if (item[k] != null && item[k] !== '') return item[k];
      if (about[k] != null && about[k] !== '') return about[k];
    }
    return null;
  };

  return {
    channel_id: pick('channelId', 'channel_id', 'id') || null,
    title:      pick('channelName', 'channelTitle', 'channel_name', 'title') || null,
    subscribers: firstCount(
      pick('numberOfSubscribers', 'channelTotalSubscribers', 'subscriberCount',
           'subscribers', 'subscribersCount')
    ),
    views: firstCount(
      pick('channelTotalViews', 'totalViews', 'viewCount', 'channelViews')
    ),
    videos: firstCount(
      pick('channelTotalVideos', 'totalVideos', 'videoCount', 'numberOfVideos')
    ),
    thumbnail_url: pick('channelAvatarUrl', 'channelThumbnail', 'avatarUrl', 'thumbnailUrl') || null,
    raw: item,
  };
}

// ─── Apify API Helper ───────────────────────────────────────────────────────
//
// Deliberately a copy of apify.service.js#_runActor rather than an import: that module
// owns the Instagram contract and this one owns YouTube, and coupling them would mean a
// change made for one silently retimes the other. The two are ~30 lines and identical on
// purpose.

const APIFY_BASE = 'https://api.apify.com/v2';

async function _runActor(actorId, input) {
  const token = env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not configured.');

  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120`;

  console.log(`[APIFY] Calling sync endpoint for ${actorId}...`);
  console.log(`[APIFY] Input:`, JSON.stringify(input));

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 180000);

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
      console.error(`[APIFY] YouTube actor call failed (HTTP ${res.status}):`, errText.substring(0, 500));
      throw new Error(`Apify YouTube call failed (HTTP ${res.status}): ${errText.substring(0, 200)}`);
    }

    const items = await res.json();
    if (!Array.isArray(items)) {
      throw new Error('Apify returned unexpected response format (expected array)');
    }

    console.log(`[APIFY] Got ${items.length} items from ${actorId}`);
    return items;
  } catch (e) {
    clearTimeout(fetchTimeout);
    if (e.name === 'AbortError') throw new Error('Apify YouTube request timed out after 3 minutes');
    throw e;
  }
}

module.exports = { fetchChannel, parseChannelRef, channelUrl, toCount };
