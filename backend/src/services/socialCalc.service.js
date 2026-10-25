'use strict';

/**
 * Item 3b — the calculations, pure and testable. No database, no network.
 * Contract: features/item3b-social-numbers · rules v1.12 §2A · prompt §3.5, §3.6
 *
 * Everything here is fed rows shaped like creator_social_posts
 *   { kind: reel|photo|carousel|long|short, published_at, likes|null, comments|null, views|null, duration_secs }
 * and answers with the numbers the screens show. "Nothing to average" is null, never 0.
 */

const WINDOW_DAYS = 90;
const WEEKS_IN_WINDOW = WINDOW_DAYS / 7;
const SHORT_MAX_SECS = 180;
// How many of the newest posts the numbers are computed from. A fixed count gives every creator
// the same statistical weight (a daily poster and a weekly poster are judged on the same number
// of posts) and it is what the market's audit tools do. The 90-day window still caps freshness,
// so a dormant account is measured on whatever little it has, and it caps the scrape cost.
const MAX_POSTS = 30;

const round1 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const num = (v) => (v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

// ── Handles ──────────────────────────────────────────────────────────────────────

/** Instagram: strip @ and instagram.com URLs; lower-case; 1–30 of [a-z0-9._]. Null when invalid. */
function normaliseInstagramHandle(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^@+/, '').toLowerCase();
  if (s.includes('/')) s = s.split('/')[0];
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/**
 * YouTube: accept @handle, youtube.com/@handle, m.youtube.com/@handle, youtube.com/channel/UC…,
 * youtube.com/c/… and youtube.com/user/…. Returns { handle, channelId, channelUrl } or null.
 */
function normaliseYoutubeRef(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i);
  if (url) s = url[1];
  s = s.split(/[?#]/)[0].replace(/\/+$/, '');
  const chan = s.match(/^channel\/(UC[\w-]{20,})$/i) || s.match(/^(UC[\w-]{20,})$/);
  if (chan) return { handle: null, channelId: chan[1], channelUrl: `https://www.youtube.com/channel/${chan[1]}` };
  const legacy = s.match(/^(?:user|c)\/([A-Za-z0-9._-]{1,100})$/i);
  if (legacy) return { handle: legacy[1].toLowerCase(), channelId: null, channelUrl: `https://www.youtube.com/@${legacy[1].toLowerCase()}` };
  const handle = s.replace(/^@+/, '').split('/')[0].toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(handle)) return null;
  return { handle, channelId: null, channelUrl: `https://www.youtube.com/@${handle}` };
}

// ── Classification of raw Apify items ──────────────────────────────────────────

/** Instagram item → post row. Reels = type Video (productType clips or any video); photos = Image; carousels = Sidecar. */
function instagramItemToPost(item) {
  const type = String(item.type || '').toLowerCase();
  const kind = type === 'sidecar' ? 'carousel' : type === 'video' ? 'reel' : 'photo';
  const likes = item.likesCount == null || Number(item.likesCount) < 0 ? null : Number(item.likesCount);
  const comments = item.isCommentsDisabled ? null : num(item.commentsCount);
  // Instagram's app shows plays for reels ("views" since 2024); videoPlayCount is that number.
  const views = kind === 'reel' ? (num(item.videoPlayCount) ?? num(item.videoViewCount)) : null;
  return {
    platform_post_id: String(item.id || item.shortCode),
    kind, tab_source: null,
    published_at: item.timestamp ? new Date(item.timestamp) : null,
    duration_secs: item.videoDuration != null ? Math.round(Number(item.videoDuration)) : null,
    likes, comments, views,
    url: item.url || null,
    owner_handle: item.ownerUsername || null,
    is_pinned: !!item.isPinned,
  };
}

/** "00:21:14" | "05:58" | "0:48" | 1274 → seconds. */
function parseDurationSecs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v);
  const parts = String(v).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((a, b) => a * 60 + b, 0);
}

/**
 * YouTube item → upload row, or null when it must be dropped (a stream, a "no videos" answer).
 * `tab` is the tab the run read: 'videos' | 'shorts' | null. YouTube decides the kind by tab;
 * the item's own `type` is used when the tab is unknown; duration only as the last fallback.
 */
function youtubeItemToUpload(item, tab) {
  if (!item || item.error || !item.id) return null;
  const type = String(item.type || '').toLowerCase();
  if (type === 'stream' || type === 'live' || item.isLive === true || item.isStream === true) return null;
  const duration = parseDurationSecs(item.duration);
  let kind, tabSource;
  if (tab === 'shorts') { kind = 'short'; tabSource = 'tab'; }
  else if (tab === 'videos') { kind = 'long'; tabSource = 'tab'; }
  else if (type === 'shorts' || type === 'short') { kind = 'short'; tabSource = 'tab'; }
  else if (type === 'video') { kind = 'long'; tabSource = 'tab'; }
  else { kind = duration != null && duration <= SHORT_MAX_SECS ? 'short' : 'long'; tabSource = 'duration_fallback'; }
  return {
    platform_post_id: String(item.id),
    kind, tab_source: tabSource,
    published_at: item.date ? new Date(item.date) : null,
    duration_secs: duration,
    likes: num(item.likes),
    comments: item.commentsTurnedOff ? null : num(item.commentsCount),
    views: num(item.viewCount),
    url: item.url || null,
    owner_handle: item.channelUsername || null,
  };
}

/** Instagram profile item → snapshot fields, or { error: 'not_found' | 'private' }. */
function instagramProfile(item) {
  if (!item) return { error: 'not_found' };
  if (item.error) return { error: /private/i.test(String(item.error) + String(item.errorDescription || '')) ? 'private' : 'not_found' };
  if (item.private === true) return { error: 'private', followers: num(item.followersCount) };
  return {
    followers: num(item.followersCount), following: num(item.followsCount), total_posts: num(item.postsCount),
    verified: !!item.verified, account_type: item.isBusinessAccount ? 'business' : (item.businessCategoryName ? 'creator' : null),
    account_type_label: item.isBusinessAccount ? 'business account' : (item.businessCategoryName ? 'creator account' : null),
    platform_account_id: item.id ? String(item.id) : null,
  };
}

/** "52000" | 52000 | "8.1K" | "1.2M subscribers" → a count, or null when unreadable. Never 0 for "unreadable". */
function parseCount(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const m = String(v).trim().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.round(n * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1)) : null;
}

/**
 * YouTube channel totals from a run's items, or { error } / { error: null, empty: true }.
 * The totals ride on every upload item, so they are read from the first item that actually
 * carries them — not from the first item that merely has no error (backend-defect-youtube-
 * shorts-only-subscribers, 25 Oct 2026: a channel that only posts shorts answers the Videos tab
 * with an error item, and the shorts' totals were being thrown away). When no item carries a
 * subscriber count the answer is "empty", never a snapshot with subscribers null.
 */
function youtubeChannel(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return { error: 'not_found' };
  const totals = (i) => parseCount(i.numberOfSubscribers ?? (i.aboutChannelInfo || {}).numberOfSubscribers);
  const first = list.find(i => !i.error && totals(i) != null);
  if (!first) {
    const bad = list.find(i => i.error);
    if (bad && !list.some(i => !i.error)) {
      if (/DOES_NOT_EXIST|NOT_FOUND/i.test(bad.error)) return { error: 'not_found' };
      if (/PRIVATE|TERMINATED|UNAVAILABLE/i.test(bad.error)) return { error: 'private' };
    }
    return { error: null, empty: true }; // e.g. CHANNEL_HAS_NO_VIDEOS / CHANNEL_HAS_NO_LIVE_VIDEOS, or items without totals
  }
  const about = first.aboutChannelInfo || {};
  return {
    subscribers: totals(first), total_videos: parseCount(first.channelTotalVideos ?? about.channelTotalVideos),
    total_channel_views: parseCount(first.channelTotalViews ?? about.channelTotalViews), channel_name: first.channelName || about.channelName || null,
    channel_id: first.channelId || about.channelId || null, channel_url: first.channelUrl || null, verified: !!first.isChannelVerified,
  };
}

// ── The numbers ───────────────────────────────────────────────────────────────────

/**
 * The posts the numbers are computed from: inside the window, de-duplicated, newest first,
 * capped at `max`. `capped` says the creator posted more than we measured.
 */
function measuredSet(rows, windowStart, windowEnd, max = MAX_POSTS) {
  const all = inWindow(rows, windowStart, windowEnd)
    .slice().sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  return { posts: all.slice(0, max), capped: all.length > max, seen: all.length };
}

/** Posts per week over the span the measured posts cover (a span under a week counts as a week). */
function perWeek(posts) {
  if (!posts.length) return 0;
  const ts = posts.map(x => new Date(x.published_at).getTime());
  const spanDays = (Math.max(...ts) - Math.min(...ts)) / 86400000;
  return posts.length / (Math.max(spanDays, 7) / 7);
}

function inWindow(rows, windowStart, windowEnd) {
  const s = windowStart.getTime(), e = windowEnd.getTime();
  const seen = new Set();
  return rows.filter(r => {
    if (!r.published_at) return false;
    const t = new Date(r.published_at).getTime();
    if (t < s || t > e) return false;
    if (seen.has(r.platform_post_id)) return false;
    seen.add(r.platform_post_id);
    return true;
  });
}

/** Instagram numbers for the measured set (rules v1.12 §2A as amended 2026-09-12). */
function instagramMetrics({ posts, followers, windowStart, windowEnd, max = MAX_POSTS }) {
  const set = measuredSet(posts || [], windowStart, windowEnd, max);
  const p = set.posts;
  const reels = p.filter(x => x.kind === 'reel'), photos = p.filter(x => x.kind === 'photo'), carousels = p.filter(x => x.kind === 'carousel');
  const visibleLikes = p.filter(x => x.likes != null).map(x => Number(x.likes));
  const comments = p.filter(x => x.comments != null).map(x => Number(x.comments));
  const reelViews = reels.filter(x => x.views != null).map(x => Number(x.views));
  const avgLikes = mean(visibleLikes), avgComments = mean(comments);
  const f = num(followers);

  // Engagement is measured against the audience that actually saw the post, the same way the
  // YouTube half of this feature already does it. Instagram pushes reels far beyond a creator's
  // own followers, so dividing likes by followers reports absurd numbers for anyone whose reels
  // travel (the first live creator read 86%). Reels are the only Instagram format the scraper
  // returns view counts for; when a creator posted no reels there is nothing to divide by, so we
  // fall back to followers and record which basis was used so the screens can say so.
  const engReels = reels.filter(x => x.likes != null && x.views != null && Number(x.views) > 0);
  const sumViews = engReels.reduce((a, x) => a + Number(x.views), 0);
  let engagement = null, engagement_basis = null;
  if (engReels.length && sumViews > 0) {
    const inter = engReels.reduce((a, x) => a + Number(x.likes) + (x.comments == null ? 0 : Number(x.comments)), 0);
    engagement = round1((inter / sumViews) * 100);
    engagement_basis = 'views';
  } else if (p.length && f && avgLikes != null) {
    engagement = round1(((avgLikes + (avgComments || 0)) / f) * 100);
    engagement_basis = 'followers';
  }

  const times = p.map(x => new Date(x.published_at).getTime());
  const last = p.length ? new Date(Math.max(...times)) : null;
  const first = p.length ? new Date(Math.min(...times)) : null;
  return {
    posts_90d: p.length, posts_per_week: round1(perWeek(p)),
    posts_seen: set.seen, capped: set.capped, measured_from: first, measured_to: last,
    reels: reels.length, photos: photos.length, carousels: carousels.length,
    last_post_at: last,
    avg_likes: round1(avgLikes), hidden_likes_count: p.length - visibleLikes.length,
    avg_comments: round1(avgComments), avg_reel_views: round1(mean(reelViews)),
    engagement, engagement_basis, followers_used: f,
    counts: { likes_used: visibleLikes.length, comments_used: comments.length, reel_views_used: reelViews.length, engagement_reels_used: engReels.length },
  };
}

/** YouTube numbers for the window, long videos and shorts separately (prompt §3.6). */
function youtubeMetrics({ uploads, windowStart, windowEnd, max = MAX_POSTS }) {
  const set = measuredSet((uploads || []).filter(x => x.kind === 'long' || x.kind === 'short'), windowStart, windowEnd, max);
  const u = set.posts;
  const perType = (kind) => {
    const xs = u.filter(x => x.kind === kind);
    const views = xs.filter(x => x.views != null).map(x => Number(x.views));
    const likes = xs.filter(x => x.likes != null).map(x => Number(x.likes));
    const comments = xs.filter(x => x.comments != null).map(x => Number(x.comments));
    const eng = xs.filter(x => x.likes != null && x.views != null && Number(x.views) > 0);
    const sumViews = eng.reduce((a, x) => a + Number(x.views), 0);
    const engagement = eng.length && sumViews > 0
      ? round1((eng.reduce((a, x) => a + Number(x.likes) + (x.comments == null ? 0 : Number(x.comments)), 0) / sumViews) * 100)
      : null;
    return { count: xs.length, avg_views: round1(mean(views)), avg_likes: round1(mean(likes)), avg_comments: round1(mean(comments)), engagement,
      counts: { views_used: views.length, likes_used: likes.length, comments_used: comments.length, engagement_used: eng.length } };
  };
  const times = u.map(x => new Date(x.published_at).getTime());
  const last = u.length ? new Date(Math.max(...times)) : null;
  const first = u.length ? new Date(Math.min(...times)) : null;
  return { uploads_90d: u.length, uploads_per_week: round1(perWeek(u)), uploads_seen: set.seen, capped: set.capped,
    measured_from: first, measured_to: last, last_upload_at: last, long: perType('long'), short: perType('short') };
}

module.exports = {
  WINDOW_DAYS, MAX_POSTS, SHORT_MAX_SECS, round1, measuredSet,
  normaliseInstagramHandle, normaliseYoutubeRef,
  instagramItemToPost, youtubeItemToUpload, parseDurationSecs, instagramProfile, youtubeChannel,
  instagramMetrics, youtubeMetrics, inWindow,
};
