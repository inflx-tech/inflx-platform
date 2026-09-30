'use strict';

/**
 * saleLive.service.js — Pay for Sale after the shoot (item 14).
 * Contract: features/item14-sale-going-live · master rules v1.30 §12.1, §19, §25 · board v2 (locked 30 Sep 2026)
 *
 * TWO PATHS, in order (founder, 30 Sep 2026):
 *   Path 1 — the shoppable post, checked by INFLX (item 13, unchanged). Read here, never written.
 *   Path 2 — the social media post, checked by the brand. It is item 12's content step, reached by
 *            `conversion` through contentGate; this file adds what item 12 does not have:
 *              · the rows SHE names (post + place), only for posts INFLX approved — Path 2 is
 *                closed until at least one is (the server refuses, not only the screen);
 *              · outside rows: links only, for posts approved after the package was first sent;
 *              · completion: confirmed live AND the minimum approved, whichever is last (§19);
 *              · self-confirmation after the stamped Admin days (D3; never Hybrid);
 *              · the six Delayed stages, the 48-hour reminders, the sales on the collaboration.
 *
 * NO MONEY MOVES in this file. Pay for Sale has no fixed money; commission already runs per item
 * through the shop (item 16) whatever the collaboration's status.
 *
 * contentFlow calls into this file for `conversion`; this file never requires contentFlow at load
 * time (it would be a cycle).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const contentGate = require('./contentGate.service');
const content = require('./content.service');
const shootGate = require('./shootGate.service');
const platformSettings = require('./platformSettings.service');
const notificationService = require('./notification.service');
const events = require('./collabEvents.service');
const { MSG, NOTIFY14, SALE_TYPES, DELAYED_STAGE_LABEL } = require('./contentCopy');
const { istDayOf, addDays, startOfIndiaDay, todayInIndia, calendarDay, daysBetween } = require('../utils/indiaDay');
const { longDate } = require('./campaignCopy');

const refuse = (code, message, status = 422, field = null) => { throw new AppError(code, message, status, field); };
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'She';
const MAX_ROWS = 20;
const SHARE_GRACE_DAYS = 2;              // "not shared yet" two days after the posting date or approval (S17)
const HOURS_48 = 48 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ───────────────────────────────────────────── Path 1: her shoppable posts (read only) */

/** Every post of this collaboration except drafts, as Path 1 shows it on both sides. */
async function postsOf(ciId, conn = db) {
  const { rows } = await conn.query(
    `SELECT cp.id, cp.status, cp.caption, cp.post_kind, cp.offer_id, cp.post_code, cp.approved_at, cp.submitted_at,
            cp.removed_reason, cs.go_live_date, o.name AS offer_name, o.status AS offer_status, o.ends_on AS offer_ends_on,
            (SELECT pm.id FROM post_media pm WHERE pm.post_id = cp.id ORDER BY pm.slide_index LIMIT 1) AS cover_id,
            (SELECT pm.mime FROM post_media pm WHERE pm.post_id = cp.id ORDER BY pm.slide_index LIMIT 1) AS cover_mime
       FROM creator_posts cp
       JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE cp.campaign_influencer_id = $1 AND cp.v2 AND cp.status <> 'draft'
      ORDER BY COALESCE(cp.approved_at, cp.submitted_at, cp.created_at), cp.id`, [ciId]);
  return rows;
}

/** A post in Path 1's words: its state, whether it counts, whether it came late. */
function postOut(p, postingDate, today) {
  const shoppable = require('./shoppablePosts.service');
  const approvedDay = p.approved_at ? istDayOf(new Date(p.approved_at)) : null;
  const base = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_PUBLIC_URL || '';
  return {
    id: p.id, title: shoppable.titleOf(p), code: p.post_code || null, kind: p.post_kind,
    offerName: p.offer_name || null,
    state: shoppable.stateOf(p, today),
    counts: !!p.approved_at,
    approvedAt: p.approved_at || null,
    late: !!(approvedDay && postingDate && approvedDay > postingDate),
    sharable: p.status === 'approved' && !!p.approved_at && shoppable.stateOf(p, today) !== 'removed',
    cover: p.cover_id ? { url: `${base}/v1/media/post/${p.cover_id}`, isVideo: String(p.cover_mime || '').startsWith('video/') } : null,
  };
}

/** Path 1 for one collaboration: the minimum, what counts, what is where, and whether Path 2 is open. */
async function path1(ciId, r, conn = db) {
  const today = todayInIndia();
  const postingDate = calendarDay(r.go_live_date);
  const posts = (await postsOf(ciId, conn)).map((p) => postOut(p, postingDate, today));
  const min = r.min_shoppable_posts != null ? Number(r.min_shoppable_posts) : Number(await platformSettings.get('min_shoppable_posts'));
  const approved = posts.filter((p) => p.counts).length;
  return {
    min, approved, short: Math.max(0, min - approved), met: approved >= min,
    late: posts.filter((p) => p.late).length,
    inReview: posts.filter((p) => p.state === 'in_review').length,
    sentBack: posts.filter((p) => p.state === 'sent_back').length,
    open: posts.some((p) => p.sharable),
    posts,
  };
}

/** How many of her posts INFLX has approved — the one number completion reads (§19, v1.30). */
async function approvedCount(ciId, conn = db) {
  const { rows: [x] } = await conn.query(
    `SELECT count(*)::int AS n FROM creator_posts WHERE campaign_influencer_id = $1 AND v2 AND approved_at IS NOT NULL`, [ciId]);
  return x.n;
}

/* ───────────────────────────────────────────── the stage */

/**
 * Path 2's stage for a sale collaboration: item 12's stage, with `posts` before anything exists and
 * Path 1 has nothing approved. `live` = confirmed, waiting on the minimum; `complete` = both done.
 */
function saleStageOf(cc, rounds, p1) {
  const st = content.stageOf(cc, rounds);
  if (st === 'draft' && !(cc && cc.first_submitted_at) && !p1.open) return 'posts';
  return st;
}

/** Whose move it is — ONE rule for the screen, Needs You and the reminders. */
function saleMove(stage, cc, rounds, since) {
  if (cc && cc.brand_reported_at) return null;
  const last = rounds[rounds.length - 1] || null;
  switch (stage) {
    case 'posts':     return { key: 'make_posts', side: 'creator', since };
    case 'draft':     return { key: 'send_social', side: 'creator', since };
    case 'changes':   return { key: 'make_changes', side: 'creator', since: last && last.verdict_at };
    case 'in_review': return { key: 'review_social', side: 'brand', since: last && last.submitted_at };
    case 'approved':  return { key: 'post_and_link', side: 'creator', since: cc.approved_at };
    case 'posted':    return { key: 'confirm_live', side: 'brand', since: cc.posted_at };
    case 'live':      return { key: 'make_posts', side: 'creator', since: cc.live_confirmed_at };
    default:          return null;
  }
}

/** The Delayed stage for a sale collaboration (§25): where it stopped, in the posts' words. */
function delayedStageForSale(stage, p1) {
  if (stage === 'complete') return null;
  if (stage === 'posts' || (stage === 'live' && !p1.met)) return 'posts_not_approved';
  return {
    draft: 'social_not_sent', in_review: 'social_in_review', changes: 'social_changes_requested',
    approved: 'social_not_posted', posted: 'social_not_confirmed',
  }[stage] || null;
}

/**
 * The same rule in SQL, for lists (the creator's cards, the brand's set rows). One of:
 * make_posts · send_social · review_social · make_changes · post_and_link · confirm_live ·
 * waiting_posts · reported · completed — or NULL when this is not a new-terms Pay for Sale
 * collaboration with its shoot done.
 */
const SALE_MOVE_SQL = (ci) => `(
  SELECT CASE
           WHEN cc.completed_at IS NOT NULL THEN 'completed'
           WHEN cc.brand_reported_at IS NOT NULL THEN 'reported'
           -- Item 15: a confirmed Hybrid collaboration still waiting for its final 50%.
           WHEN cc.live_confirmed_at IS NOT NULL AND css.goal = 'hybrid' AND EXISTS (SELECT 1 FROM escrow_entries ex
                         WHERE ex.campaign_influencer_id = ${ci}.id AND ex.status <> 'released') THEN 'final_payment'
           WHEN cc.live_confirmed_at IS NOT NULL THEN 'waiting_posts'
           WHEN cc.posted_at IS NOT NULL THEN 'confirm_live'
           WHEN cc.approved_at IS NOT NULL THEN 'post_and_link'
           WHEN cc.id IS NOT NULL AND EXISTS (SELECT 1 FROM content_rounds cr
                         WHERE cr.content_id = cc.id AND cr.round_no = cc.current_round AND cr.verdict IS NULL) THEN 'review_social'
           WHEN cc.current_round > 1 THEN 'make_changes'
           WHEN EXISTS (SELECT 1 FROM creator_posts cpx WHERE cpx.campaign_influencer_id = ${ci}.id AND cpx.v2
                           AND cpx.status = 'approved' AND cpx.approved_at IS NOT NULL) THEN 'send_social'
           ELSE 'make_posts'
         END
    FROM contracts cn
    JOIN production_events pee ON pee.contract_id = cn.id AND pee.status = 'completed'
    JOIN campaign_sets css ON css.id = ${ci}.set_id AND css.goal IN ('conversion', 'hybrid')
    LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ${ci}.id
   WHERE cn.campaign_influencer_id = ${ci}.id AND ${ci}.sell_v2
     AND cn.influencer_signed_at IS NOT NULL AND cn.brand_signed_at IS NOT NULL
   LIMIT 1)`;

/* ───────────────────────────────────────────── her rows (Path 2) */

async function lockedSale(client, g) {
  const cc = await content.ensureContent(client, g);
  content.assertNotFrozen(cc);
  const rounds = await content.roundsOf(cc.id, client);
  return { cc, rounds };
}

/** The post, if it is one of this collaboration's and INFLX has approved it and it is still in the shop. */
async function sharablePost(client, ciId, postId, r) {
  if (!UUID.test(String(postId || ''))) refuse('POST_NOT_APPROVED', MSG.SALE_POST_NOT_APPROVED, 422, 'postId');
  const { rows } = await client.query(
    `SELECT cp.*, cs.go_live_date, o.name AS offer_name, o.status AS offer_status, o.ends_on AS offer_ends_on
       FROM creator_posts cp JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE cp.id = $1 AND cp.campaign_influencer_id = $2 AND cp.v2`, [postId, ciId]);
  const p = rows[0];
  if (!p) refuse('POST_NOT_APPROVED', MSG.SALE_POST_NOT_APPROVED, 422, 'postId');
  const out = postOut(p, calendarDay(r.go_live_date), todayInIndia());
  if (!out.sharable) refuse('POST_NOT_APPROVED', MSG.SALE_POST_NOT_APPROVED, 422, 'postId');
  return p;
}

async function nextRowKey(client, contentId) {
  const { rows: [x] } = await client.query(
    `SELECT COALESCE(max(substring(row_key from 2)::int), 0) + 1 AS n FROM content_social_rows WHERE content_id = $1`, [contentId]);
  return `s${x.n}`;
}

/**
 * S8 — she names one approved post and the places she will share it. Only while the package is
 * hers (before sending, or after changes were asked). Path 1 first: with no approved post the
 * server refuses with the sentence S4 shows.
 */
async function addRows(ciId, scope, { postId, types } = {}) {
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const g = await contentGate.assertContentOpen(ciId, scope);
  if (g.aim !== 'sale') refuse('NOT_FOUND', 'Not found', 404);
  const list = [...new Set(Array.isArray(types) ? types : [types])].filter(Boolean);
  if (!list.length || list.some((t) => !SALE_TYPES[t])) refuse('UNKNOWN_TYPE', MSG.SALE_UNKNOWN_TYPE, 422, 'types');
  await db.withTransaction(async (client) => {
    const p1 = await path1(ciId, g.r, client);
    if (!p1.open) refuse('PATH1_FIRST', MSG.SALE_PATH1_FIRST, 422, 'status');
    const { cc, rounds } = await lockedSale(client, g);
    content.assertDraftOpen(cc, rounds, g.r.brand_name);
    await sharablePost(client, ciId, postId, g.r);
    const standing = g.rows.filter((x) => !x.outside);
    if (standing.length + list.length > MAX_ROWS) refuse('TOO_MANY_ROWS', MSG.SALE_TOO_MANY_ROWS, 422, 'types');
    for (const type of list) {
      if (g.rows.some((x) => x.postId === postId && x.type === type)) refuse('ROW_EXISTS', MSG.SALE_ROW_EXISTS, 422, 'types');
    }
    for (const type of list) {
      // eslint-disable-next-line no-await-in-loop
      const key = await nextRowKey(client, cc.id);
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO content_social_rows (content_id, row_key, post_id, type, outside, added_round) VALUES ($1,$2,$3,$4,false,$5)`,
        [cc.id, key, postId, type, cc.current_round]);
    }
  });
  return true;
}

/**
 * S9/S13 — take a row out while the package is hers. A row no round ever sent goes for good, with
 * its unsent files and its caption; a row an earlier round sent is only taken OUT of this round,
 * the way item 12 treats a sent file — earlier rounds are never rewritten.
 */
async function removeRow(ciId, scope, rowKey) {
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const g = await contentGate.assertContentOpen(ciId, scope);
  if (g.aim !== 'sale') refuse('NOT_FOUND', 'Not found', 404);
  const row = g.rows.find((x) => x.key === rowKey && !x.outside);
  if (!row) refuse('UNKNOWN_ROW', MSG.UNKNOWN_ROW, 422, 'rowKey');
  const keys = await db.withTransaction(async (client) => {
    const { cc, rounds } = await lockedSale(client, g);
    content.assertDraftOpen(cc, rounds, g.r.brand_name);
    const sent = rounds.some((rd) => ((rd.package_json && rd.package_json.rows) || []).some((x) => x.key === rowKey));
    const referenced = content.referencedFileIds(rounds);
    const { rows: files } = await client.query(
      `SELECT * FROM content_files WHERE content_id = $1 AND row_key = $2 AND deleted_at IS NULL AND removed_round IS NULL`, [cc.id, rowKey]);
    const gone = [];
    for (const f of files) {
      if (referenced.has(f.id)) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`UPDATE content_files SET removed_round = $2 WHERE id = $1`, [f.id, cc.current_round]);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`UPDATE content_files SET deleted_at = now() WHERE id = $1`, [f.id]);
        gone.push(f.storage_key);
      }
    }
    await client.query(`DELETE FROM content_captions WHERE content_id = $1 AND row_key = $2`, [cc.id, rowKey]);
    if (sent) await client.query(`UPDATE content_social_rows SET removed_round = $3 WHERE content_id = $1 AND row_key = $2`, [cc.id, rowKey, cc.current_round]);
    else await client.query(`DELETE FROM content_social_rows WHERE content_id = $1 AND row_key = $2`, [cc.id, rowKey]);
    return gone;
  });
  const storage = require('./contentStorage.service');
  for (const k of keys) await storage.remove(k); // eslint-disable-line no-await-in-loop
  return true;
}

/**
 * S17 — a post outside the package: approved by INFLX after she first sent it, or any post once
 * the collaboration is complete. Links only; the brand is never asked to approve it (point 2, 3).
 */
async function addOutside(ciId, scope, { postId, type } = {}) {
  if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404);
  const g = await contentGate.assertContentOpen(ciId, scope);
  if (g.aim !== 'sale') refuse('NOT_FOUND', 'Not found', 404);
  if (!SALE_TYPES[type]) refuse('UNKNOWN_TYPE', MSG.SALE_UNKNOWN_TYPE, 422, 'type');
  const key = await db.withTransaction(async (client) => {
    const { cc } = await lockedSale(client, g);
    if (!cc.first_submitted_at) refuse('OUTSIDE_NOT_OPEN', MSG.SALE_OUTSIDE_NOT_OPEN, 422, 'status');
    await sharablePost(client, ciId, postId, g.r);
    if (g.rows.some((x) => !x.outside && x.postId === postId)) refuse('IN_PACKAGE', MSG.SALE_IN_PACKAGE, 422, 'postId');
    if (g.rows.some((x) => x.postId === postId && x.type === type)) refuse('ROW_EXISTS', MSG.SALE_ROW_EXISTS, 422, 'type');
    if (g.rows.length >= MAX_ROWS * 2) refuse('TOO_MANY_ROWS', MSG.SALE_TOO_MANY_ROWS, 422, 'type');
    const k = await nextRowKey(client, cc.id);
    await client.query(
      `INSERT INTO content_social_rows (content_id, row_key, post_id, type, outside, added_round) VALUES ($1,$2,$3,$4,true,$5)`,
      [cc.id, k, postId, type, cc.current_round]);
    return k;
  });
  return key;
}

/* ───────────────────────────────────────────── completion (§19, v1.30) */

/**
 * Completed when BOTH paths are done: the live confirmation (Path 2) and the minimum approved by
 * INFLX (Path 1) — whichever comes last. Idempotent; inside the caller's transaction. The campaign
 * completes when every collaboration in it has (item 12's rule, unchanged). NO MONEY.
 * Returns { completed, completedCampaign } or null when nothing changed.
 */
async function completeIfDue(client, ciId) {
  const { rows: [x] } = await client.query(
    `SELECT ci.id, ci.status::text AS status, ci.min_shoppable_posts, cs.goal, cs.campaign_id, ci.sell_v2,
            cc.id AS cc_id, cc.live_confirmed_at, cc.completed_at, cc.brand_reported_at
       FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
      WHERE ci.id = $1 FOR UPDATE OF ci`, [ciId]);
  if (!x || !['conversion', 'hybrid'].includes(x.goal) || !x.sell_v2 || !x.cc_id || !x.live_confirmed_at || x.completed_at || x.brand_reported_at) return null;
  if (['removed', 'withdrawn', 'declined', 'expired', 'rejected_by_brand'].includes(x.status)) return null;
  const min = x.min_shoppable_posts != null ? Number(x.min_shoppable_posts) : Number(await platformSettings.get('min_shoppable_posts'));
  if ((await approvedCount(ciId, client)) < min) return null;
  // Item 15: Hybrid also needs its fixed amount paid in full — all three payments released (§19).
  if (x.goal === 'hybrid') {
    const { rows: esc } = await client.query(`SELECT status FROM escrow_entries WHERE campaign_influencer_id = $1`, [ciId]);
    if (!esc.length || esc.some((e) => e.status !== 'released')) return null;
  }
  const { rowCount } = await client.query(
    `UPDATE collab_content SET completed_at = now(), updated_at = now() WHERE id = $1 AND completed_at IS NULL`, [x.cc_id]);
  if (rowCount !== 1) return null;
  await client.query(`UPDATE campaign_influencers SET status = 'completed' WHERE id = $1 AND status <> 'completed'`, [ciId]);
  let completedCampaign = false;
  const { rows: cis } = await client.query(
    `SELECT ci.status FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE cs.campaign_id = $1`, [x.campaign_id]);
  if (cis.length > 0 && cis.every((c) => c.status === 'completed')) {
    const { rowCount: n } = await client.query(
      `UPDATE campaigns SET status = 'completed', completed_at = now() WHERE id = $1 AND status <> 'completed'`, [x.campaign_id]);
    completedCampaign = n === 1;
  }
  return { completed: true, completedCampaign };
}

/** After commit: both sides told the collaboration is complete and the selling carries on. */
async function tellCompleted(ciId) {
  const r = await contentGate.load(ciId, { side: 'admin' });
  if (!r) return;
  await tell(r, 'creator', NOTIFY14.COMPLETED, `Your collaboration with ${r.brand_name} is complete. Your posts keep selling.`);
  await tell(r, 'brand', NOTIFY14.COMPLETED, `Your collaboration with ${first(r.creator_name)} is complete. Her posts keep selling.`);
}

/**
 * item 13's hook: INFLX approved a post. If that reaches the minimum on a collaboration already
 * confirmed live, it completes now (S19 → S21). Never throws into the approval.
 */
async function afterPostApproved(postId) {
  try {
    const { rows: [p] } = await db.query(`SELECT campaign_influencer_id FROM creator_posts WHERE id = $1`, [postId]);
    if (!p) return;
    const out = await db.withTransaction((client) => completeIfDue(client, p.campaign_influencer_id));
    if (out && out.completed) await tellCompleted(p.campaign_influencer_id);
  } catch (e) {
    console.error('[sale-live] completion after approval failed:', e.message);
  }
}

/* ───────────────────────────────────────────── sales on the collaboration (S20, S21) */

/** The collaboration's orders and money, from item 16's per-item split. Cancelled items never count. */
async function salesOf(ciId, side, conn = db) {
  const { rows: [x] } = await conn.query(
    `SELECT count(DISTINCT ol.order_id)::int AS orders,
            COALESCE(sum(ol.paid_total), 0)::numeric AS sales,
            COALESCE(sum(ol.commission), 0)::numeric AS commission,
            COALESCE(sum(ol.platform_fee), 0)::numeric AS fee,
            COALESCE(sum(ol.brand_net), 0)::numeric AS brand_net,
            COALESCE(sum(ol.commission) FILTER (WHERE ft.commission_confirmed_at IS NULL), 0)::numeric AS pending
       FROM order_lines ol JOIN follower_transactions ft ON ft.id = ol.transaction_id
      WHERE ol.campaign_influencer_id = $1 AND ol.status = 'active'`, [ciId]);
  const n = (v) => Math.round(Number(v || 0) * 100) / 100;
  const out = { orders: x.orders, sales: n(x.sales), commission: n(x.commission) };
  if (side === 'creator') return { ...out, pending: n(x.pending), inWallet: n(Number(x.commission) - Number(x.pending)) };
  return { ...out, fee: n(x.fee), brandNet: n(x.brand_net) };
}

/* ───────────────────────────────────────────── the read's extra (contentFlow.shape calls this) */

/**
 * What a sale collaboration's screen needs beyond item 12's: Path 1, the rows' posts, what is not
 * shared yet, the self-confirmation date, the sales. `g` is the gate's answer, `cc`/`s` item 12's.
 */
async function saleExtra(g, cc, s, side) {
  const r = g.r;
  const p1 = await path1(r.ci_id, r);
  const stage = !g.shootDone ? 'shoot_not_done' : saleStageOf(cc, s.rounds, p1);
  const byId = new Map(p1.posts.map((p) => [p.id, p]));
  const today = todayInIndia();
  const postingDate = calendarDay(r.go_live_date);
  // Every approved post should carry at least one link by 2 days after the posting date (or its
  // approval, if later). A post without one is "not shared yet" — to the brand, with no penalty.
  const linked = new Set(g.rows.filter((row) => s.proofs.some((p) => p.row_key === row.key)).map((row) => row.postId));
  const packaged = new Set(g.rows.filter((row) => !row.outside).map((row) => row.postId));
  const notShared = p1.posts.filter((p) => p.counts && p.state !== 'removed' && !linked.has(p.id)).map((p) => {
    const from = [postingDate, p.approvedAt ? istDayOf(new Date(p.approvedAt)) : null].filter(Boolean).sort().pop();
    const dueBy = from ? addDays(from, SHARE_GRACE_DAYS) : null;
    return { postId: p.id, title: p.title, code: p.code, dueBy, overdue: !!(dueBy && today > dueBy), inPackage: packaged.has(p.id) };
  });
  const sales = await salesOf(r.ci_id, side);
  return {
    stage, p1, byId, notShared, sales,
    outsideOpen: !!(cc && cc.first_submitted_at) && !(cc && cc.brand_reported_at),
    postingDate,
    daysToPosting: postingDate ? daysBetween(today, postingDate) : null,
  };
}

/* ───────────────────────────────────────────── notices */

function tell(r, side, key, body) {
  const creator = side === 'creator';
  return notificationService.send({
    userId: creator ? r.creator_user_id : r.brand_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: creator ? { screen: 'my_going_live', campaign_influencer_id: r.ci_id }
      : { screen: 'brand_going_live', campaign_influencer_id: r.ci_id, campaign_id: r.campaign_id, set_id: r.set_id },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}
const diary = (r, side, userId, action, meta = {}) => events.record({
  campaignInfluencerId: r.ci_id, step: events.STEP.GO_LIVE, actorRole: side, actorUserId: userId || null, action, meta,
});

/* ───────────────────────────────────────────── jobs */

/**
 * D3 — Pay for Sale confirms itself at the stamped date when the brand has neither confirmed nor
 * reported. Then completion is asked in the same transaction. Hybrid never has a stamp.
 */
async function autoConfirmDue({ now = new Date() } = {}) {
  const out = { checked: 0, confirmed: 0, completed: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT cc.campaign_influencer_id AS ci_id
       FROM collab_content cc JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cs.goal = 'conversion' AND cc.posted_at IS NOT NULL AND cc.live_confirmed_at IS NULL
        AND cc.brand_reported_at IS NULL AND cc.autoconfirm_at IS NOT NULL AND cc.autoconfirm_at <= $1`, [now]);
  const told = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const { rows: [cc] } = await tx.query(
          `SELECT * FROM collab_content WHERE campaign_influencer_id = $1 FOR UPDATE SKIP LOCKED`, [row.ci_id]);
        if (!cc || cc.live_confirmed_at || cc.brand_reported_at || !cc.posted_at || !cc.autoconfirm_at || new Date(cc.autoconfirm_at) > now) return;
        const { rowCount } = await tx.query(
          `UPDATE collab_content SET live_confirmed_at = $2, live_confirmed_auto = true, updated_at = now()
            WHERE id = $1 AND live_confirmed_at IS NULL AND brand_reported_at IS NULL`, [cc.id, now]);
        if (rowCount !== 1) return;
        out.confirmed += 1;
        const done = await completeIfDue(tx, row.ci_id);
        if (done && done.completed) out.completed += 1;
        told.push({ ciId: row.ci_id, completed: !!(done && done.completed) });
      });
    } catch (e) {
      out.failed += 1;
      console.error('[sale-live:autoconfirm] failed for', row.ci_id, e.message);
    }
  }
  for (const t of told) {
    // eslint-disable-next-line no-await-in-loop
    const r = await contentGate.load(t.ciId, { side: 'admin' });
    if (!r) continue;
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'brand', NOTIFY14.LIVE_CONFIRMED, `${first(r.creator_name)}'s posts were confirmed live by themselves — you didn't answer in time.${t.completed ? ' The collaboration is complete.' : ''}`);
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'creator', NOTIFY14.LIVE_CONFIRMED, t.completed ? `Confirmed live. Your collaboration with ${r.brand_name} is complete. Your posts keep selling.`
      : `Confirmed live. It completes when INFLX has approved your minimum number of posts.`);
    diary(r, 'system', null, 'confirmed_live_auto', { completed: t.completed });
  }
  return out;
}

/** A safety sweep: any sale collaboration whose two paths are both done but was never marked. */
async function completeSweep() {
  const { rows } = await db.query(
    `SELECT cc.campaign_influencer_id AS ci_id FROM collab_content cc
       JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cs.goal IN ('conversion', 'hybrid') AND cc.live_confirmed_at IS NOT NULL AND cc.completed_at IS NULL AND cc.brand_reported_at IS NULL`);
  let completed = 0;
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const out = await db.withTransaction((tx) => completeIfDue(tx, row.ci_id)).catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    if (out && out.completed) { completed += 1; await tellCompleted(row.ci_id); }
  }
  return { checked: rows.length, completed };
}

/** The sale stage of one collaboration, read inside `conn` — for the Delayed arm and its refresh. */
async function saleStageNow(ciId, conn = db) {
  const r = await contentGate.load(ciId, { side: 'admin' }, conn);
  if (!r) return null;
  const cc = await content.contentRow(ciId, conn);
  const rounds = cc ? await content.roundsOf(cc.id, conn) : [];
  const p1 = await path1(ciId, r, conn);
  return { r, cc, rounds, p1, stage: saleStageOf(cc, rounds, p1) };
}

/**
 * §25 — the day after the posting date, a new-terms Pay for Sale collaboration whose shoot is done
 * and which is not complete is flagged Delayed with its stage. Both told ONCE. Nothing else moves.
 */
async function flagDelayedSale({ today = null } = {}) {
  const t = today || todayInIndia();
  const out = { checked: 0, flagged: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
      WHERE ci.delayed_at IS NULL AND cs.goal IN ('conversion', 'hybrid') AND ci.sell_v2
        AND cs.go_live_date IS NOT NULL AND cs.go_live_date < $1::date
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND pe.status = 'completed'
        AND (cc.id IS NULL OR cc.completed_at IS NULL)`, [t]);
  const told = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(
          `SELECT id FROM campaign_influencers WHERE id = $1 AND delayed_at IS NULL FOR UPDATE SKIP LOCKED`, [row.ci_id]);
        if (!locked[0]) return;
        const gate = await shootGate.shootGate(row.ci_id, tx);
        if (!gate || !gate.open) return;
        const now = await saleStageNow(row.ci_id, tx);
        const delayed = now && delayedStageForSale(now.stage, now.p1);
        if (!delayed) return;
        const { rowCount } = await tx.query(
          `UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = $2 WHERE id = $1 AND delayed_at IS NULL`, [row.ci_id, delayed]);
        if (rowCount === 1) { out.flagged += 1; told.push({ ciId: row.ci_id, delayed }); }
      });
    } catch (e) {
      out.failed += 1;
      console.error('[collab-delayed:sale] failed for', row.ci_id, e.message);
    }
  }
  for (const { ciId, delayed } of told) {
    // eslint-disable-next-line no-await-in-loop
    const r = await contentGate.load(ciId, { side: 'admin' });
    if (!r) continue;
    const day = longDate(calendarDay(r.go_live_date));
    const where = (DELAYED_STAGE_LABEL[delayed] || '').toLowerCase();
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'brand', NOTIFY14.DELAYED, `The ${day} posting date passed before this collaboration went live. Where it stopped: ${where}. Nothing has changed, her posts that are approved keep selling, and everything still works.`);
    // eslint-disable-next-line no-await-in-loop
    await tell(r, 'creator', NOTIFY14.DELAYED, `The ${day} posting date passed before you went live. Nothing changes: carry on from wherever you are.`);
  }
  return out;
}

/** The refresh arm (item 12's Q9 rule): the recorded stage follows a delayed sale collaboration. */
async function currentDelayedStageSale(ciId) {
  const now = await saleStageNow(ciId);
  if (!now || !now.r.sell_v2) return null;
  return delayedStageForSale(now.stage, now.p1);
}

const REMINDER = {
  make_posts:    (r) => ({ side: 'creator', body: `Going live with ${r.brand_name} is waiting on your shoppable posts. Create one and send it to INFLX.` }),
  send_social:   (r) => ({ side: 'creator', body: `INFLX approved your post. Send ${r.brand_name} what you'll share on social media.` }),
  make_changes:  (r) => ({ side: 'creator', body: `${r.brand_name} asked for changes. Send them when you're ready.` }),
  review_social: (r) => ({ side: 'brand', body: `${first(r.creator_name)} is waiting for you to approve what she'll share.` }),
  post_and_link: () => ({ side: 'creator', body: 'Approved. Post it and add the links.' }),
  confirm_live:  (r) => ({ side: 'brand', body: `${first(r.creator_name)} has posted. Open the links and confirm it's live.` }),
};

/** The 48-hour lane: one nudge to whoever owes the move, and not again within 48 hours. */
async function remindSale({ now = new Date() } = {}) {
  const out = { checked: 0, sent: 0, failed: 0 };
  const { rows } = await db.query(
    `SELECT ci.id AS ci_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN contracts con ON con.campaign_influencer_id = ci.id
       JOIN production_events pe ON pe.contract_id = con.id
       LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ci.id
      WHERE cs.goal IN ('conversion', 'hybrid') AND ci.sell_v2 AND pe.status = 'completed'
        AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
        AND (cc.id IS NULL OR (cc.completed_at IS NULL AND cc.brand_reported_at IS NULL))`);
  const sends = [];
  for (const row of rows) {
    out.checked += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.withTransaction(async (tx) => {
        const r = await contentGate.load(row.ci_id, { side: 'admin' }, tx);
        const cc = await content.ensureContent(tx, { r });
        const rounds = await content.roundsOf(cc.id, tx);
        const p1 = await path1(row.ci_id, r, tx);
        const stage = saleStageOf(cc, rounds, p1);
        const move = saleMove(stage, cc, rounds, contentGate.shootDoneAt(r));
        if (!move || !move.since || !REMINDER[move.key]) return;
        if (stage === 'live' && p1.met) return;
        const anchor = Math.max(new Date(move.since).getTime(), cc.reminder_sent_at ? new Date(cc.reminder_sent_at).getTime() : 0);
        if (now.getTime() - anchor < HOURS_48) return;
        const { rowCount } = await tx.query(
          `UPDATE collab_content SET reminder_sent_at = $2 WHERE id = $1 AND reminder_sent_at IS NOT DISTINCT FROM $3`,
          [cc.id, now, cc.reminder_sent_at]);
        if (rowCount === 1) sends.push({ r, move });
      });
    } catch (e) {
      out.failed += 1;
      console.error('[shoot-reminders:sale] failed for', row.ci_id, e.message);
    }
  }
  for (const { r, move } of sends) {
    const m = REMINDER[move.key](r);
    // eslint-disable-next-line no-await-in-loop
    await tell(r, m.side, NOTIFY14.REMINDER, m.body);
    out.sent += 1;
  }
  return out;
}

/** The stamp at "posted" (D3): the IST day + N, at the start of that day. */
async function autoconfirmStamp(now = new Date()) {
  const days = Number(await platformSettings.get('sale_live_autoconfirm_days'));
  return { days, at: startOfIndiaDay(addDays(istDayOf(now), days)) };
}

module.exports = {
  postsOf, postOut, path1, approvedCount, saleStageOf, saleMove, delayedStageForSale, SALE_MOVE_SQL,
  addRows, removeRow, addOutside, completeIfDue, tellCompleted, afterPostApproved, salesOf, saleExtra,
  autoConfirmDue, completeSweep, flagDelayedSale, currentDelayedStageSale, remindSale, autoconfirmStamp,
  tell, diary, REMINDER, MAX_ROWS, SHARE_GRACE_DAYS,
};
