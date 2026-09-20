'use strict';

/**
 * Item 3b — executes one measurement run and the hourly schedule.
 * Contract: features/item3b-social-numbers · prompt §3.2, §3.3, §3.5
 *
 * A run: pick the actors for the platform and run type → store the run (with Apify run id
 * and cost) → store the profile snapshot and every post → recompute the numbers from ALL
 * stored posts in the window → apply the state → write through to the legacy columns.
 * Budget guard (founder Q6): the month's spend comes from Apify itself (all INFLX runs);
 * when it reaches APIFY_MONTHLY_BUDGET_USD, scheduled and backfill runs stop and admin is
 * flagged once; approval, handle-confirm and Measure-now runs still go. An Apify refusal
 * for credit is `budget`, never the creator's failure.
 */

const db = require('../config/db');
const env = require('../config/env');
const apify = require('./apifyRuns.service');
const calc = require('./socialCalc.service');
const accounts = require('./socialAccounts.service');

const SCHEDULED_TRIGGERS = new Set(['schedule', 'retry', 'backfill']);
const running = new Map(); // accountId → promise (in-process double-run guard)

// ── Budget ─────────────────────────────────────────────────────────────────────────

async function monthSpend() {
  try { return await apify.monthlyUsageUsd(); } catch (e) {
    const { rows } = await db.query(`SELECT COALESCE(sum(usage_usd),0)::float AS usd FROM creator_social_runs WHERE started_at >= date_trunc('month', now())`);
    return { usd: rows[0].usd, source: 'run_log', error: e.message };
  }
}

/** True when a run with this trigger may spend. Flags admin once a month when the budget is hit. */
async function budgetAllows(trigger) {
  if (!SCHEDULED_TRIGGERS.has(trigger)) return { ok: true };
  const spend = await monthSpend();
  if (spend.usd >= env.APIFY_MONTHLY_BUDGET_USD) {
    await accounts.flag('budget', null, { usd: spend.usd, budget: env.APIFY_MONTHLY_BUDGET_USD, source: spend.source });
    return { ok: false, spend };
  }
  return { ok: true, spend };
}

// ── One run ────────────────────────────────────────────────────────────────────────

function windowFor(now) { return { start: new Date(now.getTime() - env.SOCIAL_WINDOW_DAYS * 86400000), end: now }; }

// NOTE: we deliberately fetch the whole window and cap to SOCIAL_MAX_POSTS in socialCalc. Asking
// the actor for exactly N posts was measured on 2026-09-12 and does not return the newest N.
async function instagramRun(acc, runType, ctx) {
  const out = { snapshot: null, posts: [], profileError: null, ceiling: false };
  if (runType !== 'posts') {
    const r = await ctx.call(env.APIFY_IG_PROFILE_ACTOR, { usernames: [acc.handle_norm] });
    const item = (r.items || []).find(i => String(i.username || '').toLowerCase() === acc.handle_norm) || r.items[0];
    const prof = calc.instagramProfile(item);
    if (prof.error) { out.profileError = prof.error; return out; }
    out.snapshot = prof;
  }
  if (runType !== 'profile') {
    const since = windowFor(ctx.now).start.toISOString().slice(0, 10);
    const r = await ctx.call(env.APIFY_IG_POSTS_ACTOR, { username: [acc.handle_norm], resultsLimit: env.SOCIAL_CEILING, onlyPostsNewerThan: since });
    const items = (r.items || []).filter(i => i && !i.error && (i.id || i.shortCode));
    if (r.items && r.items.length >= env.SOCIAL_CEILING) out.ceiling = true;
    // A not-found account answers the posts run with an error item and nothing else.
    if (!items.length && (r.items || []).some(i => i && i.error === 'not_found') && !out.snapshot) { out.profileError = 'not_found'; return out; }
    out.posts = items.map(calc.instagramItemToPost).filter(p => p.published_at);
  }
  return out;
}

async function youtubeRun(acc, runType, ctx) {
  const out = { snapshot: null, posts: [], profileError: null, ceiling: false };
  const url = acc.channel_url;
  // Founder, 20 Sep 2026: an account from before item 3b can have no channel address; Apify was
  // being handed an empty URL and answering "invalid-input" four times. Say why, without a call.
  if (!url) throw new Error('No channel address stored for this YouTube account — ask the creator to re-enter the handle.');
  const since = windowFor(ctx.now).start.toISOString().slice(0, 10);
  if (runType === 'profile') {
    const r = await ctx.call(env.APIFY_YOUTUBE_ACTOR, { startUrls: [{ url }], maxResults: 1, maxResultsShorts: 0, maxResultStreams: 0 });
    const ch = calc.youtubeChannel(r.items);
    if (ch.error) { out.profileError = ch.error; return out; }
    out.snapshot = ch.empty ? { subscribers: null } : ch;
    return out;
  }
  // Posts (and full): two tab-restricted runs. Channel totals ride on every item, so a full
  // run needs no separate channel read (founder Q10).
  const videos = await ctx.call(env.APIFY_YOUTUBE_ACTOR, { startUrls: [{ url }], maxResults: env.SOCIAL_CEILING, maxResultsShorts: 0, maxResultStreams: 0, oldestPostDate: since, sortVideosBy: 'NEWEST' });
  const chV = calc.youtubeChannel(videos.items);
  if (chV.error === 'not_found' || chV.error === 'private') { out.profileError = chV.error; return out; }
  const shorts = await ctx.call(env.APIFY_YOUTUBE_ACTOR, { startUrls: [{ url }], maxResults: 0, maxResultsShorts: env.SOCIAL_CEILING, maxResultStreams: 0, oldestPostDate: since, sortVideosBy: 'NEWEST' });
  const chS = calc.youtubeChannel(shorts.items);
  const good = !chV.error ? chV : (!chS.error ? chS : null);
  if (good) out.snapshot = good;
  else if (runType === 'full') {
    // No uploads on either tab: read the channel totals from the 1-result run.
    const r = await ctx.call(env.APIFY_YOUTUBE_ACTOR, { startUrls: [{ url }], maxResults: 1, maxResultsShorts: 0, maxResultStreams: 0 });
    const ch = calc.youtubeChannel(r.items);
    if (ch.error === 'not_found' || ch.error === 'private') { out.profileError = ch.error; return out; }
    out.snapshot = ch.empty ? { subscribers: null } : ch;
  }
  const v = (videos.items || []).map(i => calc.youtubeItemToUpload(i, 'videos')).filter(Boolean);
  const s = (shorts.items || []).map(i => calc.youtubeItemToUpload(i, 'shorts')).filter(Boolean);
  if ((videos.items || []).length >= env.SOCIAL_CEILING || (shorts.items || []).length >= env.SOCIAL_CEILING) out.ceiling = true;
  out.posts = v.concat(s).filter(p => p.published_at);
  return out;
}

async function storeSnapshot(tx, acc, runId, snap, now) {
  if (!snap) return;
  await tx.query(
    `INSERT INTO creator_social_profile_snapshots (account_id, run_id, measured_at, followers, following, total_posts, verified, account_type, subscribers, total_videos, total_channel_views, channel_name, channel_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [acc.id, runId, now, snap.followers ?? null, snap.following ?? null, snap.total_posts ?? null, snap.verified ?? null, snap.account_type ?? null,
     snap.subscribers ?? null, snap.total_videos ?? null, snap.total_channel_views ?? null, snap.channel_name ?? null, snap.channel_id ?? null]);
  if (snap.platform_account_id || snap.channel_id) {
    await tx.query(`UPDATE creator_social_accounts SET platform_account_id = COALESCE($2, platform_account_id) WHERE id = $1`, [acc.id, snap.platform_account_id || snap.channel_id]);
  }
}

async function storePosts(tx, acc, runId, posts) {
  for (const p of posts) {
    await tx.query(
      `INSERT INTO creator_social_posts (account_id, platform_post_id, kind, tab_source, published_at, duration_secs, likes, comments, views, url, owner_handle, first_seen_run, last_seen_run)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
       ON CONFLICT (account_id, platform_post_id) DO UPDATE SET kind = EXCLUDED.kind, tab_source = EXCLUDED.tab_source, published_at = EXCLUDED.published_at,
         duration_secs = EXCLUDED.duration_secs, likes = EXCLUDED.likes, comments = EXCLUDED.comments, views = EXCLUDED.views, url = EXCLUDED.url,
         owner_handle = EXCLUDED.owner_handle, last_seen_run = EXCLUDED.last_seen_run, updated_at = now()`,
      [acc.id, p.platform_post_id, p.kind, p.tab_source, p.published_at, p.duration_secs, p.likes, p.comments, p.views, p.url, p.owner_handle, runId]);
  }
}

async function recomputeMetrics(tx, acc, runId, now) {
  const { start, end } = windowFor(now);
  const { rows: posts } = await tx.query(`SELECT * FROM creator_social_posts WHERE account_id = $1 AND published_at >= $2 AND published_at <= $3`, [acc.id, start, end]);
  const snap = await accounts.latestSnapshot(acc.id, tx);
  await tx.query(`UPDATE creator_social_metrics SET is_current = false WHERE account_id = $1 AND is_current`, [acc.id]);
  if (acc.platform === 'instagram') {
    const m = calc.instagramMetrics({ posts, followers: snap ? snap.followers : null, windowStart: start, windowEnd: end });
    // window_start/window_end record the span the measured posts actually cover, which is what the
    // screens print ("27 Aug - 9 Sep"). For a prolific creator that is far shorter than 90 days.
    await tx.query(
      `INSERT INTO creator_social_metrics (account_id, run_id, computed_at, window_start, window_end, is_current, followers_used,
         ig_posts_90d, ig_posts_per_week, ig_reels, ig_photos, ig_carousels, ig_last_post_at, ig_avg_likes, ig_hidden_likes_count, ig_avg_comments, ig_avg_reel_views, ig_engagement, ig_engagement_basis, posts_seen, counts)
       VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [acc.id, runId, now, m.measured_from || start, m.measured_to || end, m.followers_used, m.posts_90d, m.posts_per_week, m.reels, m.photos, m.carousels, m.last_post_at, m.avg_likes, m.hidden_likes_count, m.avg_comments, m.avg_reel_views, m.engagement, m.engagement_basis, m.posts_seen, JSON.stringify(m.counts)]);
    return m;
  }
  const m = calc.youtubeMetrics({ uploads: posts, windowStart: start, windowEnd: end });
  await tx.query(
    `INSERT INTO creator_social_metrics (account_id, run_id, computed_at, window_start, window_end, is_current,
       yt_uploads_90d, yt_uploads_per_week, yt_last_upload_at,
       yt_long_count, yt_long_avg_views, yt_long_avg_likes, yt_long_avg_comments, yt_long_engagement,
       yt_short_count, yt_short_avg_views, yt_short_avg_likes, yt_short_avg_comments, yt_short_engagement, posts_seen, counts)
     VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [acc.id, runId, now, m.measured_from || start, m.measured_to || end, m.uploads_90d, m.uploads_per_week, m.last_upload_at,
     m.long.count, m.long.avg_views, m.long.avg_likes, m.long.avg_comments, m.long.engagement,
     m.short.count, m.short.avg_views, m.short.avg_likes, m.short.avg_comments, m.short.engagement, m.uploads_seen, JSON.stringify({ long: m.long.counts, short: m.short.counts })]);
  return m;
}

/**
 * Run one account. Returns { runId, result, usd, error }.
 * Never throws for a measurement outcome; throws only on programmer errors.
 */
async function runAccount(accountId, runType, trigger) {
  if (running.has(accountId)) return running.get(accountId);
  const p = (async () => {
    const acc = await accounts.byId(accountId);
    if (!acc || acc.replaced_at) return { result: 'skipped', error: 'account gone' };
    if (acc.user_status !== 'approved') return { result: 'skipped', error: `creator ${acc.user_status}` };
    if (acc.ownership !== 'confirmed') return { result: 'skipped', error: 'ownership not confirmed' };
    const now = new Date();
    const { rows: [run] } = await db.query(
      `INSERT INTO creator_social_runs (account_id, run_type, trigger, result) VALUES ($1,$2,$3,'running') RETURNING id`, [accountId, runType, trigger]);
    await db.query(`UPDATE creator_social_accounts SET running_since = now() WHERE id = $1`, [accountId]);
    const ctx = { now, usd: 0, runIds: [], actors: [], items: 0 };
    ctx.call = async (actor, input) => {
      const r = await apify.startAndWait(actor, input);
      ctx.usd += Number(r.usageTotalUsd || 0); ctx.runIds.push(r.runId); ctx.actors.push(actor); ctx.items += (r.items || []).length;
      return r;
    };
    let result = 'success', error = null, outcome = null;
    try {
      outcome = acc.platform === 'instagram' ? await instagramRun(acc, runType, ctx) : await youtubeRun(acc, runType, ctx);
      if (outcome.profileError) { result = outcome.profileError; }
    } catch (e) {
      if (e && e.run) { ctx.usd += Number(e.run.usageTotalUsd || 0); if (e.run.runId) ctx.runIds.push(e.run.runId); }
      result = e instanceof apify.ApifyRefusedError ? 'budget' : 'technical_failure';
      error = String(e.message || e).slice(0, 500);
    }
    try {
      await db.withTransaction(async (tx) => {
        if (result === 'success') {
          await storeSnapshot(tx, acc, run.id, outcome.snapshot, now);
          await storePosts(tx, acc, run.id, outcome.posts);
          await recomputeMetrics(tx, acc, run.id, now);
          if (outcome.ceiling) await accounts.flag('ceiling', acc.id, { runId: run.id, ceiling: env.SOCIAL_CEILING }, tx);
        }
        await tx.query(
          `UPDATE creator_social_runs SET finished_at = now(), result = $2, error = $3, usage_usd = $4, items_received = $5, ceiling_hit = $6,
                  apify_run_id = $7, actor = $8, detail = $9 WHERE id = $1`,
          [run.id, result, error, ctx.usd, ctx.items, !!(outcome && outcome.ceiling), ctx.runIds[0] || null, ctx.actors.join(','), JSON.stringify({ runIds: ctx.runIds })]);
        await accounts.applyRunResult(acc.id, { result, error, runType }, tx);
        if (result === 'success') await accounts.writeThrough(acc.id, tx);
      });
    } catch (e) {
      console.error('[social] storing run failed:', e.message);
      await db.query(`UPDATE creator_social_runs SET finished_at = now(), result = 'technical_failure', error = $2, usage_usd = $3 WHERE id = $1`, [run.id, `store: ${e.message}`.slice(0, 500), ctx.usd]).catch(() => {});
      await accounts.applyRunResult(acc.id, { result: 'technical_failure', error: e.message, runType }).catch(() => {});
      result = 'technical_failure'; error = e.message;
    }
    return { runId: run.id, result, usd: ctx.usd, error };
  })();
  running.set(accountId, p);
  try { return await p; } finally { running.delete(accountId); }
}

/** Fire-and-forget (approval, handle confirm, check again, measure now). */
function kick(accountId, runType, trigger) {
  setImmediate(() => runAccount(accountId, runType, trigger).catch(e => console.error('[social] run failed:', e.message)));
}

// ── Scheduler tick (hourly job) ────────────────────────────────────────────────────

function runTypeFor(acc) {
  const now = Date.now();
  const due = (t) => t && new Date(t).getTime() <= now;
  if (!acc.last_profile_at || !acc.last_posts_at) return 'full';
  const p = due(acc.profile_due_at), q = due(acc.posts_due_at);
  if (p && q) return 'full';
  if (p) return 'profile';
  if (q) return 'posts';
  return acc.retry_at && due(acc.retry_at) ? (acc.last_failed_type || 'full') : 'full';
}

async function pickDue(batch, tx) {
  const { rows } = await tx.query(
    `SELECT a.* FROM creator_social_accounts a
       JOIN influencers i ON i.id = a.influencer_id
       JOIN users u ON u.id = i.user_id
      WHERE a.replaced_at IS NULL AND u.status = 'approved' AND a.ownership = 'confirmed'
        AND a.state IN ('measuring','ok','failing','not_found','private')
        AND (a.running_since IS NULL OR a.running_since < now() - interval '30 minutes')
        AND ( (a.retry_at IS NOT NULL AND a.retry_at <= now())
           OR (a.retry_at IS NULL AND (a.profile_due_at <= now() OR a.posts_due_at <= now())) )
      ORDER BY LEAST(COALESCE(a.retry_at, 'infinity'), COALESCE(a.profile_due_at, 'infinity'), COALESCE(a.posts_due_at, 'infinity')) ASC
      LIMIT $1 FOR UPDATE SKIP LOCKED`, [batch]);
  if (rows.length) await tx.query(`UPDATE creator_social_accounts SET running_since = now() WHERE id = ANY($1::uuid[])`, [rows.map(r => r.id)]);
  return rows;
}

async function tick({ batch = env.SOCIAL_BATCH_SIZE, concurrency = env.SOCIAL_CONCURRENCY, trigger = 'schedule' } = {}) {
  const gate = await budgetAllows(trigger);
  if (!gate.ok) return { ran: 0, skipped: 'budget', spend: gate.spend };
  const due = await db.withTransaction((tx) => pickDue(batch, tx));
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < due.length) {
      const acc = due[i++];
      const t = acc.retry_at && new Date(acc.retry_at) <= new Date() ? 'retry' : trigger;
      results.push({ accountId: acc.id, ...(await runAccount(acc.id, runTypeFor(acc), t)) });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, due.length || 1)) }, worker));
  return { ran: results.length, results, spend: gate.spend };
}

module.exports = { runAccount, kick, tick, budgetAllows, monthSpend, windowFor, runTypeFor };
