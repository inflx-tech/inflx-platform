'use strict';

/**
 * post-performance-v2 — how the creator's campaign post is doing on Instagram and YouTube.
 * Contract: features/post-performance-v2 · master rules v1.35 §13A · spec P1–P12
 *
 * Source of truth = content_proofs.url (P1): every Instagram or YouTube link she hands in becomes a
 * TRACKED LINK (proof_stats) the moment it is final — a package row's links when she marks posted,
 * an outside row's link at save (P2). Screenshots (Stories) and Facebook links are never read.
 *
 * Reads go through item 3b's runner (apifyRuns.startAndWait, P4), batched up to 50 URLs per
 * platform per run, on a day curve: day 1, 2, 3, 5, 7, 10, 14, 21, 30 after tracking starts, then
 * every 14 days to day 90, then they stop (P5). Scheduled reads obey the item 3b budget guard and
 * yield to Level 1 (P6). "Update now" is once per collaboration per 24 h and budget-gated (P7);
 * admin's is exempt. A link owned by another account is read, kept, flagged and said plainly —
 * never refused (P8). A link Level 1 already measured is seeded for free (P9). Views, likes and
 * comments only — no shares, reach, saves or engagement rate (P10). Nothing here touches money.
 */

const db = require('../config/db');
const env = require('../config/env');
const apify = require('./apifyRuns.service');
const calc = require('./socialCalc.service');
const measure = require('./socialMeasure.service');
const accounts = require('./socialAccounts.service');
const AppError = require('../utils/AppError');
const { HOSTS, SALE_TYPES, TYPE_LABEL } = require('./contentCopy');
const { todayInIndia, calendarDay } = require('../utils/indiaDay');

/** Days after tracked_from on which the first nine reads are DUE (read the next morning: day 1, 2, 3, 5, 7, 10, 14, 21, 30). */
const CURVE_OFFSETS_DAYS = [0, 1, 2, 4, 6, 9, 13, 20, 29];
const AFTER_CURVE_EVERY_DAYS = 14;
const STOP_AFTER_DAYS = 90;
const BATCH = 50;
const UPDATE_NOW_EVERY_MS = 24 * 3600000;
const DAY = 86400000;

const MSG = {
  UPDATE_TOO_SOON: (ago) => `Numbers were updated ${ago}. Once a day.`,
  BUDGET_USED: "This month's budget for reading social numbers is used up. It comes back on the 1st.",
  NO_LINKS: 'No Instagram or YouTube links to read yet.',
};

/* ───────────────────────────────────────────── links */

/** Platform and post id from a pasted link, or null when it is not an Instagram/YouTube post. */
function parseLink(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (HOSTS.instagram.includes(host)) {
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? { platform: 'instagram', id: m[2] } : null;
  }
  if (HOSTS.youtube.includes(host)) {
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || null;
    else if (/^\/(shorts|live|embed)\//.test(u.pathname)) id = u.pathname.split('/').filter(Boolean)[1] || null;
    else if (u.pathname === '/watch') id = u.searchParams.get('v');
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? { platform: 'youtube', id } : null;
  }
  return null;
}

const addDaysTo = (t, n) => new Date(new Date(t).getTime() + n * DAY);

/**
 * The next due date after a read (P5): the first curve point after `after` (the later of the row's
 * due date and now, so a skipped day is caught up with ONE read), then every 14 days; never past
 * day 90 — on arrival there the job stops the row instead of reading it.
 */
function nextDueAfter(trackedFrom, currentDue, now) {
  const from = new Date(trackedFrom).getTime();
  const after = Math.max(currentDue ? new Date(currentDue).getTime() : from, now.getTime());
  const end = from + STOP_AFTER_DAYS * DAY;
  let next = CURVE_OFFSETS_DAYS.map((d) => from + d * DAY).find((t) => t > after) || null;
  if (next == null) {
    const last = from + CURVE_OFFSETS_DAYS[CURVE_OFFSETS_DAYS.length - 1] * DAY;
    next = last;
    while (next <= after) next += AFTER_CURVE_EVERY_DAYS * DAY;
  }
  return new Date(Math.min(next, end));
}

/* ───────────────────────────────────────────── tracking (P2) */

async function influencerOfContent(contentId, conn) {
  const { rows: [r] } = await conn.query(
    `SELECT ci.influencer_id FROM collab_content cc JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id WHERE cc.id = $1`, [contentId]);
  return r ? r.influencer_id : null;
}

/**
 * P9 — a link Level 1 already measured (creator_social_posts, matched by shortcode / video id in the
 * URL, since Instagram's platform_post_id is a numeric id) seeds the row at once, labelled level1.
 */
async function seedFromLevel1(conn, stat, influencerId) {
  if (!influencerId) return false;
  const { rows: [p] } = await conn.query(
    `SELECT p.* FROM creator_social_posts p JOIN creator_social_accounts a ON a.id = p.account_id
      WHERE a.influencer_id = $1 AND a.platform = $2 AND a.replaced_at IS NULL
        AND (p.platform_post_id = $3 OR p.url ~ ('(/|=)' || $3 || '(/|$|\\?)'))
      ORDER BY p.updated_at DESC LIMIT 1`, [influencerId, stat.platform, stat.platform_post_id]);
  if (!p) return false;
  const kind = p.kind === 'photo' ? 'post' : p.kind;
  await conn.query(
    `UPDATE proof_stats SET views = $2, likes = $3, likes_hidden = $4, comments = $5, comments_off = $6, published_at = $7, owner_handle = $8,
            kind = COALESCE($9, kind), numbers_at = $10, last_read_at = $10, last_source = 'level1', last_result = 'ok', updated_at = now()
      WHERE id = $1`,
    [stat.id, p.views, p.likes, p.likes == null, p.comments, p.comments == null, p.published_at, p.owner_handle, kind, p.updated_at]);
  await conn.query(
    `INSERT INTO proof_stat_reads (stat_id, run_id, measured_at, source, result, views, likes, likes_hidden, comments, comments_off, owner_handle, raw)
     VALUES ($1, NULL, $2, 'level1', 'ok', $3, $4, $5, $6, $7, $8, $9)`,
    [stat.id, p.updated_at, p.views, p.likes, p.likes == null, p.comments, p.comments == null, p.owner_handle, JSON.stringify({ level1PostId: p.id })]);
  return true;
}

/**
 * Track one proof slot. An open row for the same slot with the SAME link is left alone; one with a
 * different link (an outside row whose link she replaced) is closed `link_changed` and a new row
 * opened. Returns the open row, or null when the link is not Instagram/YouTube.
 */
async function trackOne(conn, contentId, rowKey, slot, url, { trackedFrom = new Date(), influencerId = null } = {}) {
  const parsed = parseLink(url);
  const { rows: open } = await conn.query(
    `SELECT * FROM proof_stats WHERE content_id = $1 AND row_key = $2 AND slot = $3 AND stopped_at IS NULL`, [contentId, rowKey, slot]);
  if (open[0] && open[0].url_sent === url) return open[0];
  if (open[0]) {
    await conn.query(`UPDATE proof_stats SET stopped_at = now(), stop_reason = 'link_changed', updated_at = now() WHERE id = $1`, [open[0].id]);
  }
  if (!parsed) return null;
  const { rows: [stat] } = await conn.query(
    `INSERT INTO proof_stats (content_id, row_key, slot, platform, url_sent, platform_post_id, tracked_from, next_due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
    [contentId, rowKey, slot, parsed.platform, url, parsed.id, trackedFrom]);
  await seedFromLevel1(conn, stat, influencerId || await influencerOfContent(contentId, conn));
  return stat;
}

/**
 * Track every link of the given rows (the package rows at markPosted, P2). Rows are the gate's
 * rows ({ key, platform, isStory, outside }); Story and Facebook rows never get a row here.
 */
async function trackRows(conn, contentId, rows, { trackedFrom = new Date() } = {}) {
  const influencerId = await influencerOfContent(contentId, conn);
  const keys = rows.filter((r) => !r.isStory && (r.platform === 'instagram' || r.platform === 'youtube')).map((r) => r.key);
  if (!keys.length) return [];
  const { rows: proofs } = await conn.query(
    `SELECT row_key, slot, url FROM content_proofs WHERE content_id = $1 AND row_key = ANY($2::text[]) AND url IS NOT NULL ORDER BY row_key, slot`, [contentId, keys]);
  const out = [];
  for (const p of proofs) {
    // eslint-disable-next-line no-await-in-loop
    const s = await trackOne(conn, contentId, p.row_key, p.slot, p.url, { trackedFrom, influencerId });
    if (s) out.push(s);
  }
  return out;
}

/* ───────────────────────────────────────────── one reading of a batch (P3, P4, P8) */

const lower = (s) => (s == null ? null : String(s).toLowerCase());
const youtubeHandleOf = (channelUrl) => { const r = calc.normaliseYoutubeRef(channelUrl); return r ? r.handle : null; };

/** The creator's confirmed account on this platform, or null (then the owner is `owner_unknown`, never flagged). */
async function confirmedAccount(influencerId, platform, conn = db) {
  const { rows } = await conn.query(
    `SELECT * FROM creator_social_accounts WHERE influencer_id = $1 AND platform = $2 AND replaced_at IS NULL AND ownership = 'confirmed' LIMIT 1`,
    [influencerId, platform]);
  return rows[0] || null;
}

/** P8 — is this item hers? Her handle as the owner, or among the co-authors (Instagram); her channel (YouTube). */
function ownerState(platform, item, acc) {
  if (!acc) return 'owner_unknown';
  if (platform === 'instagram') {
    const owner = lower(item.ownerUsername);
    const co = (item.coauthorProducers || []).map((u) => lower(u && u.username)).filter(Boolean);
    return owner === acc.handle_norm || co.includes(acc.handle_norm) ? 'match' : 'other_account';
  }
  const user = lower(item.channelUsername);
  const chan = item.channelId ? String(item.channelId) : null;
  const mine = [acc.handle_norm, youtubeHandleOf(acc.channel_url)].filter(Boolean);
  if ((chan && acc.platform_account_id && chan === String(acc.platform_account_id)) || (user && mine.includes(user))) return 'match';
  return 'other_account';
}

/** One raw item → the reading. `null` when the item carries no post at all. */
function readingOf(platform, item) {
  if (!item) return null;
  if (item.error) {
    return { result: /private/i.test(String(item.error) + String(item.errorDescription || '')) ? 'private' : 'not_found', raw: item };
  }
  if (platform === 'instagram') {
    const p = calc.instagramItemToPost(item);
    if (!item.shortCode && !item.id) return { result: 'unreadable', raw: item };
    return {
      result: 'ok', raw: item,
      kind: p.kind === 'photo' ? 'post' : p.kind, views: p.views, likes: p.likes, likesHidden: item.likesCount != null && Number(item.likesCount) < 0,
      comments: p.comments, commentsOff: !!item.isCommentsDisabled, publishedAt: p.published_at, ownerHandle: item.ownerUsername || null,
    };
  }
  const u = calc.youtubeItemToUpload(item, null);
  if (!u) return { result: 'unreadable', raw: item };
  return {
    result: 'ok', raw: item,
    kind: u.kind, views: u.views, likes: u.likes, likesHidden: u.likes == null, comments: u.comments, commentsOff: !!item.commentsTurnedOff,
    publishedAt: u.published_at, ownerHandle: item.channelUsername || null,
  };
}

/** Match the answers to the links by shortcode / video id — never by position (probe: a missing YouTube id answers no item). */
function itemFor(platform, items, stat) {
  if (platform === 'instagram') {
    return items.find((i) => i && i.shortCode === stat.platform_post_id)
      || items.find((i) => i && i.error && (parseLink(i.url || i.inputUrl || '') || {}).id === stat.platform_post_id)
      || null;
  }
  return items.find((i) => i && String(i.id || '') === stat.platform_post_id)
    || items.find((i) => i && i.error && (parseLink(i.url || i.inputUrl || i.startUrl || '') || {}).id === stat.platform_post_id)
    || null;
}

function actorFor(platform) { return platform === 'instagram' ? env.APIFY_IG_POSTS_ACTOR : env.APIFY_YOUTUBE_ACTOR; }
function inputFor(platform, stats) {
  const urls = stats.map((s) => s.url_sent);
  // E7: the URLs exactly as she pasted them — the probe read /shorts/, youtu.be and watch?v= each on its own.
  return platform === 'instagram'
    ? { username: urls }
    : { startUrls: urls.map((url) => ({ url })), maxResults: 1, maxResultsShorts: 1, maxResultStreams: 0 };
}

async function flagOwnerMismatch(conn, stat, acc, reading, ctx) {
  const { rows: [open] } = await conn.query(
    `SELECT 1 FROM social_admin_flags WHERE kind = 'owner_mismatch' AND resolved_at IS NULL AND detail->>'statId' = $1`, [stat.id]);
  if (open) return;
  await accounts.flag('owner_mismatch', acc.id, {
    statId: stat.id, ciId: ctx.ci_id, rowKey: stat.row_key, slot: stat.slot, platform: stat.platform, url: stat.url_sent,
    expected: acc.handle_norm, found: reading.ownerHandle, label: ctx.label, campaignName: ctx.campaign_name, setName: ctx.set_name, creatorName: ctx.creator_name,
  }, conn);
}

/** The collaboration behind a tracked link, for the flag's words and the ownership check. */
async function contextOf(conn, stats) {
  if (!stats.length) return new Map();
  const { rows } = await conn.query(
    `SELECT cc.id AS content_id, ci.id AS ci_id, ci.influencer_id, cs.name AS set_name, c.name AS campaign_name, COALESCE(i.full_name, u.name) AS creator_name
       FROM collab_content cc JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
      WHERE cc.id = ANY($1::uuid[])`, [[...new Set(stats.map((s) => s.content_id))]]);
  return new Map(rows.map((r) => [r.content_id, r]));
}

/**
 * One Apify run for one platform over up to 50 links. Records the run (with its Apify run id and
 * cost), writes a reading per link, updates each link's latest numbers and its next due date.
 * Never throws for a measurement outcome. Returns { runId, result, usd, read, error }.
 */
async function readBatch(platform, stats, { trigger = 'schedule', detail = {}, now = new Date() } = {}) {
  if (!stats.length) return null;
  const actor = actorFor(platform);
  const { rows: [run] } = await db.query(
    `INSERT INTO post_stat_runs (platform, trigger, actor, urls_sent, detail) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [platform, trigger, actor, stats.length, JSON.stringify(detail)]);
  let out = null; let result = 'success'; let error = null;
  try {
    out = await apify.startAndWait(actor, inputFor(platform, stats));
  } catch (e) {
    if (e && e.run) out = e.run;
    result = e instanceof apify.ApifyRefusedError ? 'budget' : 'technical_failure';
    error = String(e.message || e).slice(0, 500);
  }
  const usd = out ? Number(out.usageTotalUsd || 0) : 0;
  const items = out && Array.isArray(out.items) ? out.items : [];
  let read = 0;
  if (result === 'success') {
    const ctx = await contextOf(db, stats);
    const accByInf = new Map();
    for (const stat of stats) {
      const c = ctx.get(stat.content_id) || {};
      const key = `${c.influencer_id}:${platform}`;
      // eslint-disable-next-line no-await-in-loop
      if (!accByInf.has(key)) accByInf.set(key, c.influencer_id ? await confirmedAccount(c.influencer_id, platform) : null);
      const acc = accByInf.get(key);
      const item = itemFor(platform, items, stat);
      // A YouTube id that answers nothing is not found (probe); an Instagram one answers an error item.
      const reading = item ? readingOf(platform, item) : { result: 'not_found', raw: null };
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO proof_stat_reads (stat_id, run_id, measured_at, source, result, views, likes, likes_hidden, comments, comments_off, owner_handle, raw)
           VALUES ($1, $2, $3, 'apify', $4, $5, $6, $7, $8, $9, $10, $11)`,
          [stat.id, run.id, now, reading.result, reading.views ?? null, reading.likes ?? null, !!reading.likesHidden, reading.comments ?? null, !!reading.commentsOff,
            reading.ownerHandle || null, reading.raw == null ? null : JSON.stringify(reading.raw)]);
        if (reading.result === 'ok') {
          const owner = ownerState(platform, item, acc);
          const due = !stat.next_due_at || new Date(stat.next_due_at) <= now;
          const next = due ? nextDueAfter(stat.tracked_from, stat.next_due_at, now) : stat.next_due_at;
          await tx.query(
            `UPDATE proof_stats SET reads = reads + 1, views = $2, likes = $3, likes_hidden = $4, comments = $5, comments_off = $6, published_at = COALESCE($7, published_at),
                    owner_handle = $8, owner_state = $9, kind = COALESCE($10, kind), numbers_at = $11, last_read_at = $11, last_source = 'apify', last_result = 'ok',
                    next_due_at = $12, updated_at = now()
              WHERE id = $1`,
            [stat.id, reading.views, reading.likes, !!reading.likesHidden, reading.comments, !!reading.commentsOff, reading.publishedAt, reading.ownerHandle, owner, reading.kind, now, next]);
          if (owner === 'other_account') await flagOwnerMismatch(tx, stat, acc, reading, { ...c, label: await labelOfStat(stat, c.ci_id) });
        } else if (reading.result === 'not_found' || reading.result === 'private') {
          await tx.query(
            `UPDATE proof_stats SET reads = reads + 1, last_read_at = $2, last_source = 'apify', last_result = $3, stopped_at = $2, stop_reason = $3, updated_at = now() WHERE id = $1`,
            [stat.id, now, reading.result]);
        } else {
          // Unreadable: the due date stays, so it is tried again on the next run; the last numbers stay.
          await tx.query(`UPDATE proof_stats SET reads = reads + 1, last_read_at = $2, last_source = 'apify', last_result = 'unreadable', updated_at = now() WHERE id = $1`, [stat.id, now]);
        }
      });
      read += 1;
    }
  }
  await db.query(
    `UPDATE post_stat_runs SET finished_at = now(), result = $2, error = $3, usage_usd = $4, items_received = $5, apify_run_id = $6 WHERE id = $1`,
    [run.id, result, error, usd, items.length, out && out.runId ? out.runId : null]);
  return { runId: run.id, result, usd, read, error, apifyRunId: out && out.runId ? out.runId : null };
}

/** The row's human label for the admin's flag ("Instagram reel 1 of 2"); the key and slot when the gate cannot say. */
async function labelOfStat(stat, ciId) {
  try {
    const gate = require('./contentGate.service');
    const g = await gate.assertContentOpen(ciId, { side: 'admin' }, db, { allowShootNotDone: true, allowOldTerms: true, allowLocked: true });
    const row = (g.rows || []).find((r) => r.key === stat.row_key);
    if (row) return labelFor({ saleType: g.aim === 'sale' ? row.type : null, type: row.type, count: row.count, slot: stat.slot });
  } catch { /* the key and slot below */ }
  return `${stat.row_key} · ${stat.slot}`;
}

/** Read these links now, one run per platform, in batches of 50. */
async function readStats(stats, opts) {
  const results = [];
  for (const platform of ['instagram', 'youtube']) {
    const mine = stats.filter((s) => s.platform === platform);
    for (let i = 0; i < mine.length; i += BATCH) {
      // eslint-disable-next-line no-await-in-loop
      const r = await readBatch(platform, mine.slice(i, i + BATCH), opts);
      if (r) results.push({ platform, ...r });
    }
  }
  return results;
}

/* ───────────────────────────────────────────── the daily job (P5, P6) */

/** A Pay for Sale link whose shoppable post left the shop stops (P5). Idempotent. */
async function stopLeftShop(now = new Date()) {
  const { rowCount } = await db.query(
    `UPDATE proof_stats ps SET stopped_at = $1, stop_reason = 'post_left_shop', updated_at = now()
       FROM content_social_rows sr JOIN creator_posts cp ON cp.id = sr.post_id
      WHERE ps.stopped_at IS NULL AND sr.content_id = ps.content_id AND sr.row_key = ps.row_key AND cp.status = 'removed'`, [now]);
  return rowCount;
}

/** Day 90 passed: a due row whose date is at the end of the curve stops instead of reading (P5, E10). */
async function stopDay90(now = new Date()) {
  const { rowCount } = await db.query(
    `UPDATE proof_stats SET stopped_at = $1, stop_reason = 'day_90', updated_at = now()
      WHERE stopped_at IS NULL AND next_due_at <= $1 AND next_due_at >= tracked_from + ($2 || ' days')::interval`, [now, String(STOP_AFTER_DAYS)]);
  return rowCount;
}

async function dueLinks(now = new Date(), limit = 1000) {
  const { rows } = await db.query(
    `SELECT * FROM proof_stats WHERE stopped_at IS NULL AND next_due_at IS NOT NULL AND next_due_at <= $1 ORDER BY next_due_at ASC, created_at ASC LIMIT $2`, [now, limit]);
  return rows;
}

/**
 * The daily tick (06:10 IST, after the hour's Level 1 tick). Behind the item 3b budget guard for
 * `schedule` and `backfill`; a skipped day leaves every due date due, so it is caught up next time.
 */
async function runDue({ trigger = 'schedule', now = new Date() } = {}) {
  const gate = await measure.budgetAllows(trigger);
  if (!gate.ok) return { ran: 0, read: 0, skipped: 'budget', spend: gate.spend };
  const leftShop = await stopLeftShop(now);
  const day90 = await stopDay90(now);
  const due = await dueLinks(now);
  const runs = await readStats(due, { trigger, now, detail: { due: due.length } });
  return { ran: runs.length, read: runs.reduce((n, r) => n + r.read, 0), due: due.length, stopped: { leftShop, day90 }, runs, spend: gate.spend };
}

/* ───────────────────────────────────────────── Update now (P7) */

const agoWords = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.round(ms / 3600000);
  return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
};

async function openLinksOf(contentIds) {
  if (!contentIds.length) return [];
  const { rows } = await db.query(`SELECT * FROM proof_stats WHERE content_id = ANY($1::uuid[]) AND stopped_at IS NULL ORDER BY created_at`, [contentIds]);
  return rows;
}

/** The last successful Update now for this key (a collaboration or a campaign) within 24 h, or null. */
async function lastUpdateNow(key, id) {
  const { rows: [r] } = await db.query(
    `SELECT max(started_at) AS at FROM post_stat_runs WHERE trigger = 'update_now' AND result = 'success' AND detail->>$1 = $2 AND started_at > now() - interval '24 hours'`, [key, id]);
  return r && r.at ? new Date(r.at) : null;
}

async function budgetForUpdateNow() {
  const spend = await measure.monthSpend();
  if (spend.usd >= env.APIFY_MONTHLY_BUDGET_USD) throw new AppError('BUDGET_USED', MSG.BUDGET_USED, 422, 'status');
  return spend;
}

/**
 * Update now for one collaboration: every open link of its content read once. Once per 24 h
 * (422 UPDATE_TOO_SOON), budget-gated (422 BUDGET_USED) unless `admin`.
 */
async function refreshCollab(ciId, { trigger = 'update_now', now = new Date() } = {}) {
  const { rows: [cc] } = await db.query(`SELECT id FROM collab_content WHERE campaign_influencer_id = $1`, [ciId]);
  const links = cc ? await openLinksOf([cc.id]) : [];
  if (!links.length) throw new AppError('NO_LINKS', MSG.NO_LINKS, 422, 'status');
  if (trigger === 'update_now') {
    const last = await lastUpdateNow('ciId', ciId);
    if (last) throw new AppError('UPDATE_TOO_SOON', MSG.UPDATE_TOO_SOON(agoWords(now - last)), 422, 'status');
    await budgetForUpdateNow();
  }
  const runs = await readStats(links, { trigger, now, detail: { ciId } });
  return { links: links.length, runs };
}

/** Update now for a whole campaign (the website's one button): every open link of every collaboration in it. */
async function refreshCampaign(campaignId, { now = new Date() } = {}) {
  const { rows } = await db.query(
    `SELECT cc.id FROM collab_content cc JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id JOIN campaign_sets cs ON cs.id = ci.set_id WHERE cs.campaign_id = $1`, [campaignId]);
  const links = await openLinksOf(rows.map((r) => r.id));
  if (!links.length) throw new AppError('NO_LINKS', MSG.NO_LINKS, 422, 'status');
  const last = await lastUpdateNow('campaignId', campaignId);
  if (last) throw new AppError('UPDATE_TOO_SOON', MSG.UPDATE_TOO_SOON(agoWords(now - last)), 422, 'status');
  await budgetForUpdateNow();
  const runs = await readStats(links, { trigger: 'update_now', now, detail: { campaignId } });
  return { links: links.length, runs };
}

/* ───────────────────────────────────────────── what the screens read */

/** The stat row that stands for a slot: the open one, else the latest closed one that was not replaced. */
function pickBySlot(rows) {
  const out = new Map();
  for (const r of rows) {
    const k = `${r.row_key}:${r.slot}`;
    const cur = out.get(k);
    if (!cur) { out.set(k, r); continue; }
    if (!r.stopped_at && cur.stopped_at) out.set(k, r);
    else if (!!r.stopped_at === !!cur.stopped_at && new Date(r.created_at) > new Date(cur.created_at)) out.set(k, r);
  }
  for (const [k, r] of out) if (r.stop_reason === 'link_changed') out.delete(k);
  return out;
}

const num = (v) => (v == null ? null : Number(v));

/** One link's `stats` as every screen reads it (spec §6 states). `row` is { platform, isStory }. */
function statsFor(stat, { platform, isStory } = {}, proof = {}) {
  if (isStory || proof.screenshotFileId) return { state: 'story' };
  if (platform === 'facebook') return { state: 'facebook' };
  if (!stat) return { state: 'waiting' };
  const hasNumbers = !!stat.numbers_at;
  let state;
  if (stat.stop_reason === 'not_found' || stat.stop_reason === 'private') state = 'gone';
  else if (stat.stopped_at) state = hasNumbers ? 'stopped' : 'gone';
  else if (!hasNumbers) state = stat.last_result === 'unreadable' ? 'unreadable' : 'waiting';
  else if (stat.last_result === 'unreadable') state = 'unreadable';
  else if (stat.owner_state === 'other_account') state = 'other_account';
  else state = 'ok';
  return {
    state, platform: stat.platform, kind: stat.kind || null, url: stat.url_sent,
    views: hasNumbers ? num(stat.views) : null, likes: hasNumbers ? num(stat.likes) : null, comments: hasNumbers ? num(stat.comments) : null,
    likesHidden: hasNumbers ? !!stat.likes_hidden : false, commentsOff: hasNumbers ? !!stat.comments_off : false,
    updatedAt: stat.numbers_at || null, source: hasNumbers ? stat.last_source : null, sourceAt: hasNumbers && stat.last_source === 'level1' ? stat.numbers_at : null,
    ownerState: stat.owner_state || null, ownerHandle: stat.owner_handle || null,
    lastReadAt: stat.last_read_at || null, stoppedAt: stat.stopped_at || null, stopReason: stat.stop_reason || null,
    publishedAt: stat.published_at || null, trackedFrom: stat.tracked_from, reads: stat.reads,
  };
}

/** Item 12/14's content read, with `stats` on every proof (E3, E8). `out` is contentFlow's shape, mutated. */
async function decorateRead(out, contentId) {
  const rows = out && Array.isArray(out.rows) ? out.rows : [];
  if (!rows.length) return out;
  const { rows: all } = contentId ? await db.query(`SELECT * FROM proof_stats WHERE content_id = $1`, [contentId]) : { rows: [] };
  const bySlot = pickBySlot(all);
  // Her confirmed handle per platform, for the creator's "This link isn't on your account @…" line.
  const mine = {};
  if (all.some((s) => s.owner_state === 'other_account')) {
    const { rows: accs } = await db.query(
      `SELECT a.platform, a.handle_norm FROM creator_social_accounts a JOIN campaign_influencers ci ON ci.influencer_id = a.influencer_id
        JOIN collab_content cc ON cc.campaign_influencer_id = ci.id WHERE cc.id = $1 AND a.replaced_at IS NULL AND a.ownership = 'confirmed'`, [contentId]);
    for (const a of accs) mine[a.platform] = a.handle_norm;
  }
  let tracked = 0;
  for (const row of rows) {
    for (const p of row.proofs || []) {
      const stat = bySlot.get(`${row.key}:${p.slot}`) || null;
      p.stats = p.filled ? statsFor(stat, row, p) : null;
      if (p.stats && p.stats.ownerState === 'other_account') p.stats.myHandle = mine[p.stats.platform] || null;
      if (stat && !stat.stopped_at) tracked += 1;
    }
  }
  const last = await lastUpdateNowFor(out.invitationId);
  out.social = { tracked, canUpdate: tracked > 0, lastUpdateNowAt: last ? last.toISOString() : null };
  return out;
}
async function lastUpdateNowFor(ciId) { return ciId ? lastUpdateNow('ciId', ciId) : null; }

/** A row's human label for the website and the flags: "Instagram reel 1 of 2" / "Instagram reel · Festive Sarees (K7M2F9)". */
function labelFor({ saleType, type, count, slot, postTitle, postCode }) {
  if (saleType) return `${SALE_TYPES[saleType] ? SALE_TYPES[saleType].label : saleType}${postTitle ? ` · ${postTitle}${postCode ? ` (${postCode})` : ''}` : ''}`;
  const base = TYPE_LABEL[type] || type || 'Link';
  return count > 1 ? `${base} ${slot} of ${count}` : `${base} 1 of 1`;
}

const sumNumbers = (list) => {
  const read = list.filter((s) => s && s.updatedAt);
  const sum = (k) => read.reduce((n, s) => n + (s[k] == null ? 0 : Number(s[k])), 0);
  const updatedAt = read.map((s) => s.updatedAt).sort().pop() || null;
  return { views: sum('views'), likes: sum('likes'), comments: sum('comments'), links: list.length, read: read.length, updatedAt };
};

/** The links of shoppable posts (Pay for Sale rows), keyed by post id: for the set posts list, post status and post stats. */
async function linksOfPosts(postIds) {
  const out = new Map(postIds.map((id) => [id, []]));
  if (!postIds.length) return out;
  const { rows } = await db.query(
    `SELECT ps.*, sr.type AS sale_type, sr.post_id, sr.outside
       FROM proof_stats ps JOIN content_social_rows sr ON sr.content_id = ps.content_id AND sr.row_key = ps.row_key
      WHERE sr.post_id = ANY($1::uuid[]) ORDER BY ps.created_at`, [postIds]);
  const byPost = new Map();
  for (const r of rows) { if (!byPost.has(r.post_id)) byPost.set(r.post_id, []); byPost.get(r.post_id).push(r); }
  for (const [postId, list] of byPost) {
    const picked = [...pickBySlot(list).values()];
    out.set(postId, picked.map((s) => ({
      rowKey: s.row_key, type: s.sale_type, label: SALE_TYPES[s.sale_type] ? SALE_TYPES[s.sale_type].label : s.sale_type, platform: s.platform, url: s.url_sent,
      date: s.published_at || s.tracked_from, outside: !!s.outside,
      stats: statsFor(s, { platform: s.platform, isStory: false }, { url: s.url_sent }),
    })));
  }
  return out;
}

/**
 * One post's social summary: `{ views, likes, comments, links, read, missing, updatedAt, lastReadAt, stopped, items[] }`.
 * `missing` (M3): no tracked link yet AND the posting date has passed (or there is none).
 */
function summaryOf(items, { postingDate = null, today = todayInIndia() } = {}) {
  const totals = sumNumbers(items.map((i) => i.stats));
  const day = calendarDay(postingDate);
  const missing = items.length === 0 && (!day || day <= today);
  const stopped = items.length > 0 && items.every((i) => i.stats.stoppedAt);
  const lastReadAt = items.map((i) => i.stats.lastReadAt).filter(Boolean).sort().pop() || null;
  return { ...totals, missing, stopped, lastReadAt, items: items.map((i) => ({ rowKey: i.rowKey, type: i.type, label: i.label, platform: i.platform, url: i.url, date: i.date, views: i.stats.views, state: i.stats.state })) };
}

async function socialOfPost(postId, opts = {}) {
  const links = (await linksOfPosts([postId])).get(postId) || [];
  return { summary: summaryOf(links, opts), links };
}

async function summariesOfPosts(posts, { postingDate = null } = {}) {
  const map = await linksOfPosts(posts.map((p) => p.id));
  const out = new Map();
  for (const p of posts) out.set(p.id, summaryOf(map.get(p.id) || [], { postingDate }));
  return out;
}

/* ───────────────────────────────────────────── the website (E11) */

const AIM_LABEL = { engagement: 'Pay for Content', conversion: 'Pay for Sale', hybrid: 'Hybrid' };

/**
 * GET /brands/me/campaigns/:id/engagement — the new shape: totals, by set, by creator, by link.
 * Every link she handed in (package links once she marked posted; outside links at once), with the
 * same state words as the apps. Creators with no link yet show as `missing` (W1: "Social links not added yet").
 */
async function campaignEngagement(campaignId) {
  const { rows: [campaign] } = await db.query(`SELECT id, name FROM campaigns WHERE id = $1`, [campaignId]);
  if (!campaign) return null;
  const { rows: cis } = await db.query(
    `SELECT ci.id AS ci_id, ci.status, ci.influencer_id, cs.id AS set_id, cs.name AS set_name, cs.goal, cs.go_live_date,
            i.instagram_handle, COALESCE(i.full_name, u.name) AS creator_name, cc.id AS content_id, cc.posted_at, con.terms_json
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
       LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
      WHERE cs.campaign_id = $1 AND ci.status IN ('contracted','active','completed') ORDER BY cs.created_at, ci.created_at`, [campaignId]);
  const contentIds = cis.map((c) => c.content_id).filter(Boolean);
  const { rows: proofs } = contentIds.length ? await db.query(
    `SELECT cp.content_id, cp.row_key, cp.slot, cp.url, cp.screenshot_file_id, sr.type AS sale_type, sr.outside,
            p.caption, p.post_kind, o.name AS offer_name, p.post_code
       FROM content_proofs cp LEFT JOIN content_social_rows sr ON sr.content_id = cp.content_id AND sr.row_key = cp.row_key
       LEFT JOIN creator_posts p ON p.id = sr.post_id LEFT JOIN brand_offers o ON o.id = p.offer_id
      WHERE cp.content_id = ANY($1::uuid[]) ORDER BY cp.row_key, cp.slot`, [contentIds]) : { rows: [] };
  const { titleOf } = require('./shoppablePosts.service');
  for (const p of proofs) p.post_title = p.sale_type ? titleOf(p) : null;
  const { rows: allStats } = contentIds.length ? await db.query(`SELECT * FROM proof_stats WHERE content_id = ANY($1::uuid[])`, [contentIds]) : { rows: [] };
  const statsByContent = new Map();
  for (const s of allStats) { if (!statsByContent.has(s.content_id)) statsByContent.set(s.content_id, []); statsByContent.get(s.content_id).push(s); }
  const { rowsOf } = require('./contentGate.service');

  const links = [];
  const byCreator = [];
  const today = todayInIndia();
  for (const c of cis) {
    const handle = c.instagram_handle ? `@${c.instagram_handle}` : c.creator_name;
    const mine = proofs.filter((p) => p.content_id === c.content_id && (p.outside || c.posted_at));
    const bySlot = pickBySlot(statsByContent.get(c.content_id) || []);
    const contentRows = c.goal === 'engagement' ? (rowsOf(c.terms_json) || []) : [];
    const creatorLinks = mine.map((p) => {
      const crow = contentRows.find((r) => r.key === p.row_key) || null;
      const platform = p.sale_type ? SALE_TYPES[p.sale_type].platform : crow ? crow.platform : (parseLink(p.url || '') || {}).platform || null;
      const isStory = p.sale_type ? p.sale_type === 'story' : !!(crow && crow.isStory);
      const stat = bySlot.get(`${p.row_key}:${p.slot}`) || null;
      return {
        ciId: c.ci_id, influencerId: c.influencer_id, handle, name: c.creator_name, setId: c.set_id, setName: c.set_name, aim: AIM_LABEL[c.goal] || c.goal,
        rowKey: p.row_key, slot: p.slot, label: labelFor({ saleType: p.sale_type, type: crow ? crow.type : null, count: crow ? crow.count : 1, slot: p.slot, postTitle: p.post_title, postCode: p.post_code }),
        postTitle: p.post_title || null, postCode: p.post_code || null, url: p.url, screenshot: !!p.screenshot_file_id, platform,
        stats: statsFor(stat, { platform, isStory }, { url: p.url, screenshotFileId: p.screenshot_file_id }),
      };
    });
    links.push(...creatorLinks);
    const trackable = creatorLinks.filter((l) => ['instagram', 'youtube'].includes(l.platform) && !l.screenshot);
    const totals = sumNumbers(trackable.map((l) => l.stats));
    const day = calendarDay(c.go_live_date);
    byCreator.push({ ciId: c.ci_id, influencerId: c.influencer_id, handle, name: c.creator_name, setId: c.set_id, setName: c.set_name, aim: AIM_LABEL[c.goal] || c.goal,
      ...totals, missing: trackable.length === 0 && (!day || day <= today) });
  }
  const setMap = new Map();
  for (const c of byCreator) {
    if (!setMap.has(c.setId)) setMap.set(c.setId, { setId: c.setId, setName: c.setName, aim: c.aim, creators: 0, views: 0, likes: 0, comments: 0, links: 0, read: 0 });
    const s = setMap.get(c.setId);
    s.creators += 1; s.views += c.views; s.likes += c.likes; s.comments += c.comments; s.links += c.links; s.read += c.read;
  }
  const trackable = links.filter((l) => ['instagram', 'youtube'].includes(l.platform) && !l.screenshot);
  const t = sumNumbers(trackable.map((l) => l.stats));
  const last = await lastUpdateNow('campaignId', campaignId);
  return {
    campaignId: campaign.id, campaignName: campaign.name,
    totals: { views: t.views, likes: t.likes, comments: t.comments, links: t.links, linksRead: t.read, waiting: trackable.filter((l) => l.stats.state === 'waiting').length, updatedAt: t.updatedAt },
    bySet: [...setMap.values()], byCreator, links,
    canUpdate: trackable.some((l) => !l.stats.stoppedAt), lastUpdateNowAt: last ? last.toISOString() : null,
  };
}

/* ───────────────────────────────────────────── admin costs (E12) */

async function monthRuns(month) {
  const { rows } = await db.query(
    `SELECT platform, count(*)::int AS runs, COALESCE(sum(usage_usd),0)::float AS usd
       FROM post_stat_runs WHERE date_trunc('month', started_at) = date_trunc('month', COALESCE($1::date, now())) GROUP BY platform ORDER BY platform`, [month]);
  return { byPlatform: rows, runs: rows.reduce((a, r) => a + r.runs, 0), usd: Math.round(rows.reduce((a, r) => a + r.usd, 0) * 10000) / 10000 };
}

module.exports = {
  parseLink, nextDueAfter, CURVE_OFFSETS_DAYS, AFTER_CURVE_EVERY_DAYS, STOP_AFTER_DAYS, BATCH, MSG,
  trackOne, trackRows, seedFromLevel1,
  readBatch, readStats, runDue, stopLeftShop, stopDay90, dueLinks,
  refreshCollab, refreshCampaign, lastUpdateNow,
  statsFor, decorateRead, labelFor, summaryOf, socialOfPost, summariesOfPosts, linksOfPosts, campaignEngagement, monthRuns,
  ownerState, readingOf, itemFor, inputFor,
};
