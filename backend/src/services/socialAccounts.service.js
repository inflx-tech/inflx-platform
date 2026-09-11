'use strict';

/**
 * Item 3b — social accounts: one row per creator per platform, its state, the ownership
 * check on changed handles, and the write-through to the five legacy number columns.
 * Contract: features/item3b-social-numbers · rules v1.12 §2A · prompt §3.1, §3.7, §4
 *
 * This module is the ONLY writer of influencers.followers_count / engagement_rate /
 * scrape_last_run / youtube_subscribers / youtube_scrape_last_run after item 3b.
 */

const db = require('../config/db');
const env = require('../config/env');
const calc = require('./socialCalc.service');
const { MSG } = require('./socialCopy');

const PLATFORMS = ['instagram', 'youtube'];
const GOOD = new Set(['ok', 'failing']);
const BRAND_STATE = { ok: 'ok', failing: 'stale', measuring: 'updating', waiting_check: 'updating', waiting_approval: 'updating', not_found: 'unavailable', private: 'unavailable', rejected: 'unavailable' };

function err(code, message, status = 422, field) { return Object.assign(new Error(message), { code, status, field }); }

// ── Reads ──────────────────────────────────────────────────────────────────────────

async function current(influencerId, platform, tx = db) {
  const { rows } = await tx.query(`SELECT * FROM creator_social_accounts WHERE influencer_id = $1 AND platform = $2 AND replaced_at IS NULL`, [influencerId, platform]);
  return rows[0] || null;
}
async function currentAll(influencerId, tx = db) {
  const { rows } = await tx.query(`SELECT * FROM creator_social_accounts WHERE influencer_id = $1 AND replaced_at IS NULL`, [influencerId]);
  return Object.fromEntries(rows.map(r => [r.platform, r]));
}
async function byId(accountId, tx = db) {
  const { rows } = await tx.query(`SELECT a.*, u.status AS user_status FROM creator_social_accounts a JOIN influencers i ON i.id = a.influencer_id JOIN users u ON u.id = i.user_id WHERE a.id = $1`, [accountId]);
  return rows[0] || null;
}
async function latestSnapshot(accountId, tx = db) {
  const { rows } = await tx.query(`SELECT * FROM creator_social_profile_snapshots WHERE account_id = $1 ORDER BY measured_at DESC LIMIT 1`, [accountId]);
  return rows[0] || null;
}
async function currentMetrics(accountId, tx = db) {
  const { rows } = await tx.query(`SELECT * FROM creator_social_metrics WHERE account_id = $1 AND is_current LIMIT 1`, [accountId]);
  return rows[0] || null;
}

// ── Handle validation ───────────────────────────────────────────────────────────────

/** Returns { handle_raw, handle_norm, channel_url, platform_account_id } or throws the exact §6 message. */
function normalise(platform, raw) {
  if (platform === 'instagram') {
    const h = calc.normaliseInstagramHandle(raw);
    if (!h) throw err('VALIDATION_ERROR', MSG.INSTAGRAM_INVALID, 422, 'instagram_handle');
    return { handle_raw: String(raw).trim(), handle_norm: h, channel_url: `https://www.instagram.com/${h}`, platform_account_id: null };
  }
  const ref = calc.normaliseYoutubeRef(raw);
  if (!ref) throw err('VALIDATION_ERROR', MSG.YOUTUBE_INVALID, 422, 'youtube_handle');
  return { handle_raw: String(raw).trim(), handle_norm: ref.handle || ref.channelId.toLowerCase(), channel_url: ref.channelUrl, platform_account_id: ref.channelId };
}

/** The value stored in influencers.instagram_handle / youtube_handle for a normalised account. */
function legacyHandle(platform, n) { return platform === 'instagram' ? n.handle_norm : (n.platform_account_id || n.handle_norm); }

// ── Registration and approval ───────────────────────────────────────────────────────

/** Registration: rows in waiting_approval, nothing measured, nothing scraped. */
async function ensureForRegistration(influencerId, handles, tx = db) {
  const out = {};
  for (const platform of PLATFORMS) {
    const raw = handles[platform];
    if (!raw) continue;
    const n = normalise(platform, raw);
    const { rows } = await tx.query(
      `INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, channel_url, platform_account_id, state, ownership)
       VALUES ($1,$2,$3,$4,$5,$6,'waiting_approval','pending') RETURNING *`,
      [influencerId, platform, n.handle_raw, n.handle_norm, n.channel_url, n.platform_account_id]);
    out[platform] = rows[0];
  }
  return out;
}

/** Admin approved the creator: every waiting handle is hers, and its first full run is due now. */
async function onCreatorApproved(influencerId, adminId, tx = db) {
  const { rows } = await tx.query(
    `UPDATE creator_social_accounts
        SET state = 'measuring', ownership = 'confirmed', ownership_by = $2, ownership_at = now(),
            profile_due_at = now(), posts_due_at = now(), retry_at = NULL, updated_at = now()
      WHERE influencer_id = $1 AND replaced_at IS NULL AND state = 'waiting_approval'
      RETURNING *`, [influencerId, adminId || null]);
  return rows;
}

// ── Handle change / add / remove (prompt §3.1, A5) ──────────────────────────────────

/**
 * Set a platform's handle for a creator. `raw` null removes it.
 * approved=false (creator not approved yet): edits just save.
 * approved=true: change/add → old numbers cleared, new row waiting_check for admin; remove → cleared.
 * Returns { action: 'none'|'add'|'change'|'remove', account }.
 */
async function setHandle(influencerId, platform, raw, { approved }) {
  return db.withTransaction(async (tx) => {
    const cur = await current(influencerId, platform, tx);
    const other = await current(influencerId, platform === 'instagram' ? 'youtube' : 'instagram', tx);
    if (raw == null || String(raw).trim() === '') {
      if (!cur) return { action: 'none', account: null };
      if (!other) throw err('VALIDATION_ERROR', MSG.LAST_ACCOUNT, 422, `${platform}_handle`);
      await tx.query(`UPDATE creator_social_accounts SET replaced_at = now(), updated_at = now() WHERE id = $1`, [cur.id]);
      await tx.query(`UPDATE influencers SET ${platform}_handle = NULL WHERE id = $1`, [influencerId]);
      await clearPlatform(influencerId, platform, tx);
      return { action: 'remove', account: null };
    }
    const n = normalise(platform, raw);
    if (cur && cur.handle_norm === n.handle_norm) return { action: 'none', account: cur };
    const action = cur ? 'change' : 'add';
    if (!approved) {
      if (cur) await tx.query(`UPDATE creator_social_accounts SET replaced_at = now(), updated_at = now() WHERE id = $1`, [cur.id]);
      const { rows } = await tx.query(
        `INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, channel_url, platform_account_id, state, ownership, replaced_by)
         VALUES ($1,$2,$3,$4,$5,$6,'waiting_approval','pending',NULL) RETURNING *`,
        [influencerId, platform, n.handle_raw, n.handle_norm, n.channel_url, n.platform_account_id]);
      await tx.query(`UPDATE influencers SET ${platform}_handle = $2 WHERE id = $1`, [influencerId, legacyHandle(platform, n)]);
      return { action, account: rows[0] };
    }
    if (cur) await tx.query(`UPDATE creator_social_accounts SET replaced_at = now(), updated_at = now() WHERE id = $1`, [cur.id]);
    const { rows } = await tx.query(
      `INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, channel_url, platform_account_id, state, ownership)
       VALUES ($1,$2,$3,$4,$5,$6,'waiting_check','pending') RETURNING *`,
      [influencerId, platform, n.handle_raw, n.handle_norm, n.channel_url, n.platform_account_id]);
    if (cur) await tx.query(`UPDATE creator_social_accounts SET replaced_by = $2 WHERE id = $1`, [cur.id, rows[0].id]);
    await tx.query(`UPDATE influencers SET ${platform}_handle = $2 WHERE id = $1`, [influencerId, legacyHandle(platform, n)]);
    await clearPlatform(influencerId, platform, tx);
    return { action, account: rows[0] };
  });
}

async function confirmOwnership(accountId, adminId) {
  const { rows } = await db.query(
    `UPDATE creator_social_accounts
        SET state = 'measuring', ownership = 'confirmed', ownership_by = $2, ownership_at = now(),
            profile_due_at = now(), posts_due_at = now(), retry_at = NULL, failure_count = 0, last_error = NULL, updated_at = now()
      WHERE id = $1 AND replaced_at IS NULL AND state = 'waiting_check' RETURNING *`, [accountId, adminId]);
  if (!rows[0]) throw err('NOT_FOUND', 'No pending handle check for this account', 404);
  return rows[0];
}

async function rejectOwnership(accountId, adminId, reason) {
  const { rows } = await db.query(
    `UPDATE creator_social_accounts
        SET state = 'rejected', ownership = 'rejected', ownership_by = $2, ownership_at = now(), last_error = $3, updated_at = now()
      WHERE id = $1 AND replaced_at IS NULL AND state = 'waiting_check' RETURNING *`, [accountId, adminId, reason || null]);
  if (!rows[0]) throw err('NOT_FOUND', 'No pending handle check for this account', 404);
  await clearPlatform(rows[0].influencer_id, rows[0].platform);
  return rows[0];
}

/** Creator's "Check again": only in private or failing, once per 24 h per platform. */
async function checkAgain(influencerId, platform) {
  const cur = await current(influencerId, platform);
  if (!cur) throw err('NOT_FOUND', 'No such account', 404);
  if (!['private', 'failing'].includes(cur.state)) throw err('NOT_ALLOWED', MSG.CHECK_AGAIN_NOT_ALLOWED, 409);
  if (cur.last_check_again_at && Date.now() - new Date(cur.last_check_again_at).getTime() < env.SOCIAL_CHECK_AGAIN_HOURS * 3600000) {
    throw err('RATE_LIMITED', MSG.CHECK_AGAIN_LIMIT, 429);
  }
  const { rows } = await db.query(`UPDATE creator_social_accounts SET last_check_again_at = now(), updated_at = now() WHERE id = $1 RETURNING *`, [cur.id]);
  return rows[0];
}

// ── Run results → state (prompt §3.1) ──────────────────────────────────────────────

async function flag(kind, accountId, detail = {}, tx = db) {
  if (kind === 'failing_3') {
    const { rows } = await tx.query(`SELECT 1 FROM social_admin_flags WHERE kind = 'failing_3' AND account_id = $1 AND resolved_at IS NULL`, [accountId]);
    if (rows[0]) return null;
  }
  if (kind === 'budget') {
    const { rows } = await tx.query(`SELECT 1 FROM social_admin_flags WHERE kind = 'budget' AND resolved_at IS NULL AND date_trunc('month', created_at) = date_trunc('month', now())`);
    if (rows[0]) return null;
  }
  const { rows } = await tx.query(`INSERT INTO social_admin_flags (kind, account_id, detail) VALUES ($1,$2,$3) RETURNING *`, [kind, accountId || null, JSON.stringify(detail)]);
  return rows[0];
}

/**
 * Apply a run's outcome. `result` ∈ success | not_found | private | technical_failure | budget.
 * Due dates are set by the caller for successes (it knows the run type).
 */
async function applyRunResult(accountId, { result, error, runType }, tx = db) {
  const acc = await byId(accountId, tx);
  if (!acc) return null;
  const sets = ['running_since = NULL', 'updated_at = now()'];
  const params = [accountId];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (result === 'success') {
    sets.push(`state = 'ok'`, 'failure_count = 0', 'retry_at = NULL', 'last_error = NULL');
    const now = 'now()';
    if (runType === 'full' || runType === 'profile') sets.push(`last_profile_at = ${now}`, `profile_due_at = ${now} + make_interval(days => ${p(env.SOCIAL_PROFILE_EVERY_DAYS)})`);
    if (runType === 'full' || runType === 'posts') sets.push(`last_posts_at = ${now}`, `posts_due_at = ${now} + make_interval(days => ${p(env.SOCIAL_POSTS_EVERY_DAYS)})`);
  } else if (result === 'not_found' || result === 'private') {
    sets.push(`state = ${p(result)}`, 'failure_count = 0', 'retry_at = NULL', `last_error = ${p(error || null)}`,
      `profile_due_at = now() + make_interval(days => ${p(env.SOCIAL_PROFILE_EVERY_DAYS)})`, `posts_due_at = now() + make_interval(days => ${p(env.SOCIAL_POSTS_EVERY_DAYS)})`);
  } else if (result === 'budget') {
    sets.push(`retry_at = now() + interval '1 day'`, `last_error = ${p(error || 'Apify refused the run: usage limit')}`);
  } else {
    const hasGood = !!acc.last_profile_at;
    sets.push(`failure_count = failure_count + 1`, `retry_at = now() + interval '1 day'`, `last_error = ${p(error || null)}`,
      `state = ${p(hasGood ? 'failing' : 'measuring')}`);
  }
  const { rows } = await tx.query(`UPDATE creator_social_accounts SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  const updated = rows[0];
  if (result === 'technical_failure' && updated.failure_count >= 3) await flag('failing_3', accountId, { failures: updated.failure_count, error }, tx);
  if (result === 'not_found' || result === 'private') await clearPlatform(updated.influencer_id, updated.platform, tx);
  return updated;
}

// ── Write-through to the five legacy columns (prompt §3.7) ─────────────────────────

async function clearPlatform(influencerId, platform, tx = db) {
  if (platform === 'instagram') await tx.query(`UPDATE influencers SET followers_count = NULL, engagement_rate = NULL, scrape_last_run = NULL WHERE id = $1`, [influencerId]);
  else await tx.query(`UPDATE influencers SET youtube_subscribers = NULL, youtube_scrape_last_run = NULL, youtube_views = NULL, youtube_videos = NULL WHERE id = $1`, [influencerId]);
}

/** After a successful run: the current account's latest snapshot + metrics into the legacy columns. */
async function writeThrough(accountId, tx = db) {
  const acc = await byId(accountId, tx);
  if (!acc || acc.replaced_at || !GOOD.has(acc.state)) return;
  const snap = await latestSnapshot(accountId, tx);
  const met = await currentMetrics(accountId, tx);
  if (acc.platform === 'instagram') {
    await tx.query(`UPDATE influencers SET followers_count = $2, engagement_rate = $3, scrape_last_run = $4, verified = COALESCE($5, verified) WHERE id = $1`,
      [acc.influencer_id, snap ? snap.followers : null, met ? met.ig_engagement : null, acc.last_profile_at, snap ? snap.verified : null]);
  } else {
    await tx.query(`UPDATE influencers SET youtube_subscribers = $2, youtube_scrape_last_run = $3, youtube_views = $4, youtube_videos = $5, youtube_channel_id = COALESCE($6, youtube_channel_id), youtube_title = COALESCE($7, youtube_title) WHERE id = $1`,
      [acc.influencer_id, snap ? snap.subscribers : null, acc.last_profile_at, snap ? snap.total_channel_views : null, snap ? snap.total_videos : null, snap ? snap.channel_id : null, snap ? snap.channel_name : null]);
  }
}

// ── Views for the API (A1, A2, A3) ───────────────────────────────────────────────────

const n1 = (v) => (v == null ? null : Number(v));

function cardNumbers(acc, snap, met) {
  if (acc.platform === 'instagram') {
    return { followers: snap ? n1(snap.followers) : null, engagement: met ? n1(met.ig_engagement) : null, avgReelViews: met ? n1(met.ig_avg_reel_views) : null, posts90d: met ? n1(met.ig_posts_90d) : null };
  }
  return { subscribers: snap ? n1(snap.subscribers) : null, avgLongViews: met ? n1(met.yt_long_avg_views) : null, avgShortsViews: met ? n1(met.yt_short_avg_views) : null, uploads90d: met ? n1(met.yt_uploads_90d) : null };
}

function accountHeader(acc, snap) {
  return {
    platform: acc.platform,
    handle: acc.platform === 'instagram' ? acc.handle_norm : (acc.handle_raw && acc.handle_raw.startsWith('@') ? acc.handle_raw.slice(1) : (acc.handle_norm.startsWith('uc') ? (snap && snap.channel_name) || acc.handle_norm : acc.handle_norm)),
    url: acc.channel_url,
    verified: snap ? !!snap.verified : false,
    accountTypeLabel: acc.platform === 'instagram' ? (snap && snap.account_type ? `${snap.account_type} account` : null) : null,
    channelName: acc.platform === 'youtube' && snap ? snap.channel_name : null,
  };
}

/** A1: what a BRAND may see — coarse state, no reasons. */
async function brandView(influencerId) {
  const accs = await currentAll(influencerId);
  const out = { instagram: null, youtube: null };
  for (const platform of PLATFORMS) {
    const acc = accs[platform];
    if (!acc) continue;
    const brandState = BRAND_STATE[acc.state] || 'updating';
    const show = brandState === 'ok' || brandState === 'stale';
    const snap = show ? await latestSnapshot(acc.id) : null;
    const met = show ? await currentMetrics(acc.id) : null;
    out[platform] = {
      state: brandState,
      ...accountHeader(acc, snap),
      ...(show ? cardNumbers(acc, snap, met) : {}),
      updatedAt: show ? acc.last_profile_at : null,
    };
  }
  return out;
}

/** A2 / A3 detail: every number for one platform. forBrand hides internal states. */
async function detail(influencerId, platform, { forBrand }) {
  const acc = await current(influencerId, platform);
  if (!acc) return null;
  const brandState = BRAND_STATE[acc.state] || 'updating';
  const show = GOOD.has(acc.state);
  const snap = await latestSnapshot(acc.id);
  const met = await currentMetrics(acc.id);
  const base = { state: forBrand ? brandState : acc.state, ...accountHeader(acc, show ? snap : null), profileMeasuredAt: acc.last_profile_at, postsMeasuredAt: acc.last_posts_at, postsDueAt: acc.posts_due_at, updatedAt: acc.last_profile_at };
  if (!show) return forBrand ? { ...base, numbers: null } : { ...base, numbers: null, lastError: acc.last_error, checkAgainAvailableAt: nextCheckAgain(acc) };
  const window = met ? { start: met.window_start, end: met.window_end } : null;
  const numbers = platform === 'instagram' ? {
    followers: n1(snap && snap.followers), following: n1(snap && snap.following), totalPosts: n1(snap && snap.total_posts),
    posts90d: n1(met && met.ig_posts_90d), postsPerWeek: n1(met && met.ig_posts_per_week), reels: n1(met && met.ig_reels), photos: n1(met && met.ig_photos), carousels: n1(met && met.ig_carousels),
    lastPostAt: met ? met.ig_last_post_at : null, avgLikes: n1(met && met.ig_avg_likes), avgComments: n1(met && met.ig_avg_comments), avgReelViews: n1(met && met.ig_avg_reel_views),
    engagement: n1(met && met.ig_engagement), hiddenLikesCount: n1(met && met.ig_hidden_likes_count), followersUsed: n1(met && met.followers_used),
  } : {
    subscribers: n1(snap && snap.subscribers), totalVideos: n1(snap && snap.total_videos), totalViews: n1(snap && snap.total_channel_views),
    uploads90d: n1(met && met.yt_uploads_90d), uploadsPerWeek: n1(met && met.yt_uploads_per_week), lastUploadAt: met ? met.yt_last_upload_at : null,
    long: { count: n1(met && met.yt_long_count), avgViews: n1(met && met.yt_long_avg_views), avgLikes: n1(met && met.yt_long_avg_likes), avgComments: n1(met && met.yt_long_avg_comments), engagement: n1(met && met.yt_long_engagement) },
    short: { count: n1(met && met.yt_short_count), avgViews: n1(met && met.yt_short_avg_views), avgLikes: n1(met && met.yt_short_avg_likes), avgComments: n1(met && met.yt_short_avg_comments), engagement: n1(met && met.yt_short_engagement) },
  };
  return { ...base, window, numbers, ...(forBrand ? {} : { lastError: acc.last_error, checkAgainAvailableAt: nextCheckAgain(acc) }) };
}

function nextCheckAgain(acc) {
  if (!acc.last_check_again_at) return null;
  const t = new Date(acc.last_check_again_at).getTime() + env.SOCIAL_CHECK_AGAIN_HOURS * 3600000;
  return t > Date.now() ? new Date(t) : null;
}

/** R3 chip: Fix > Waiting > Measuring > none. */
function chipFor(accs) {
  const fix = PLATFORMS.filter(p => accs[p] && ['not_found', 'private', 'rejected'].includes(accs[p].state));
  if (fix.length === 2) return 'fix_accounts';
  if (fix.length === 1) return `fix_${fix[0]}`;
  if (PLATFORMS.some(p => accs[p] && accs[p].state === 'waiting_check')) return 'waiting';
  if (PLATFORMS.some(p => accs[p] && accs[p].state === 'measuring')) return 'measuring';
  return null;
}

/** A3: the creator's own view — full internal state per platform + the row chip. */
async function mine(influencerId) {
  const accs = await currentAll(influencerId);
  const out = { instagram: null, youtube: null, chip: chipFor(accs) };
  for (const platform of PLATFORMS) {
    const acc = accs[platform];
    if (!acc) continue;
    const show = GOOD.has(acc.state);
    const snap = show ? await latestSnapshot(acc.id) : null;
    const met = show ? await currentMetrics(acc.id) : null;
    out[platform] = {
      state: acc.state, ...accountHeader(acc, snap),
      handleRaw: acc.handle_raw,
      ...(show ? cardNumbers(acc, snap, met) : {}),
      lastProfileAt: acc.last_profile_at, lastPostsAt: acc.last_posts_at, postsDueAt: acc.posts_due_at,
      checkAgainAvailableAt: nextCheckAgain(acc), failureCount: acc.failure_count,
    };
  }
  return out;
}

module.exports = {
  PLATFORMS, BRAND_STATE, normalise, legacyHandle,
  current, currentAll, byId, latestSnapshot, currentMetrics,
  ensureForRegistration, onCreatorApproved, setHandle, confirmOwnership, rejectOwnership, checkAgain,
  applyRunResult, flag, clearPlatform, writeThrough,
  brandView, detail, mine, chipFor,
};
