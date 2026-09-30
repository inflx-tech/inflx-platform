'use strict';

/**
 * contentGate.service.js — may this collaboration reach the content step?
 * Contract: features/item12-content · rules v1.29 §12.2 · gap report §5 · approval §3.1
 *
 * ONE definition, asked by EVERY content path, reads and writes alike:
 *
 *   0. ownership   — the owning brand through its own campaign and set, or that creator.
 *                    Anything else is 404, never 403 (items 10/11, check 26). Asked FIRST so a
 *                    stranger can never learn from a gate sentence that the collaboration exists.
 *   1. the gate    — item 10/11's `shootGate`, unchanged: signed by both, funded, tranche 1 out.
 *   2. the Aim     — Pay for Content only (`campaign_sets.goal = 'engagement'`). Else 404.
 *   3. the shoot   — `production_events.status = 'completed'`, written by every completing path
 *                    for both modes (item 10's confirm and auto-confirm, item 11's shoot done).
 *                    NEVER `shootPlan.stageOf`, which treats a brand-only legacy mark as done.
 *   4. the rows    — the agreement's snapshot must list content (v1.29 / Q7). The live
 *                    `formats_json` is never used in its place: the rows were fixed at signing.
 *
 * `allowShootNotDone` is for the read (G1) alone: C15 and C2 draw "Shoot not done yet", and a
 * read that refused could not draw it (item 10/11's F1 precedent). Every write refuses.
 *
 * Item 14 (rules v1.30 §12.1, board v2) — Pay for Sale reaches the SAME step as Path 2, the social
 * media post the brand approves. Two differences, and only for `conversion`:
 *   · the collaboration must be on the new creator terms (`sell_v2`) — old-terms collaborations
 *     have no shoppable posts (S24); the read draws that, every write refuses;
 *   · the rows are the ones SHE named (content_social_rows), not the agreement's. There may be
 *     none yet: Path 2 opens only once INFLX has approved one of her posts (saleLive.addRows).
 * Pay for Content is unchanged, line for line (check 18). Hybrid stays refused until item 15.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const shootGate = require('./shootGate.service');
const { MSG: MSG10 } = require('./productionCopy');
const { MSG, PLATFORM_OF_TYPE, TYPE_LABEL, SALE_TYPES } = require('./contentCopy');

const PAY_FOR_CONTENT = 'engagement';
const PAY_FOR_SALE = 'conversion';

const SELECT = `
  SELECT ci.id AS ci_id, ci.status AS ci_status, ci.influencer_id, ci.delayed_at, ci.delayed_stage, ci.sell_v2,
         ci.min_shoppable_posts,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode AS set_mode, cs.go_live_date,
         c.id AS campaign_id, c.name AS campaign_name, c.brand_id, c.status AS campaign_status,
         b.business_name AS brand_name, bu.id AS brand_user_id,
         COALESCE(i.full_name, u.name) AS creator_name, u.id AS creator_user_id,
         con.id AS contract_id, con.status AS contract_status, con.terms_json,
         pe.id AS pe_id, pe.mode AS pe_mode, pe.status AS pe_status,
         pe.brand_completed_at, pe.auto_confirmed_at, pe.visit_completed_at, pe.influencer_completed_at
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id JOIN users bu ON bu.id = b.user_id
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
    LEFT JOIN production_events pe ON pe.contract_id = con.id`;

/**
 * The collaboration, SCOPED TO THE CALLER, or null.
 *   { side: 'brand',   userId, campaignId, setId } — through its own campaign and set;
 *   { side: 'creator', userId }                    — her own;
 *   { side: 'admin' }                              — unscoped; callers add their own rule
 *                                                    (G12: only once reported).
 */
async function load(ciId, scope, conn = db) {
  if (!scope || !['brand', 'creator', 'admin'].includes(scope.side)) return null;
  if (scope.side === 'admin') {
    return (await conn.query(`${SELECT} WHERE ci.id = $1`, [ciId])).rows[0] || null;
  }
  const where = scope.side === 'brand' ? 'bu.id = $2' : 'u.id = $2';
  const { rows } = await conn.query(`${SELECT} WHERE ci.id = $1 AND ${where}`, [ciId, scope.userId]);
  const r = rows[0];
  if (!r) return null;
  if (scope.side === 'brand'
    && ((scope.campaignId && r.campaign_id !== scope.campaignId) || (scope.setId && r.set_id !== scope.setId))) return null;
  return r;
}

/**
 * The deliverable rows, from the SIGNED snapshot and nowhere else (§22).
 * Row key = the type — §7A forbids a type twice on one agreement. A snapshot that nonetheless
 * repeats one gets `type#2`, so no two rows can ever share a key. Returns null when the snapshot
 * lists nothing, or anything that is not a real deliverable: INFLX settles that, not the code.
 */
function rowsOf(terms) {
  const list = terms && terms.work && Array.isArray(terms.work.deliverables) ? terms.work.deliverables : [];
  if (!list.length) return null;
  const seen = {};
  const rows = [];
  for (const d of list) {
    const count = Number(d && d.count);
    if (!d || !PLATFORM_OF_TYPE[d.type] || !Number.isInteger(count) || count < 1 || count > 20) return null;
    seen[d.type] = (seen[d.type] || 0) + 1;
    rows.push({
      key: seen[d.type] === 1 ? d.type : `${d.type}#${seen[d.type]}`,
      type: d.type,
      count,
      label: TYPE_LABEL[d.type],
      platform: PLATFORM_OF_TYPE[d.type],
      isStory: d.type === 'story',
    });
  }
  return rows;
}

/**
 * Item 14 — the rows she named, still standing, oldest first. Each is one social post: count 1,
 * one link (or a Story screenshot). `outside` rows are links only and never go in a package.
 */
async function saleRowsOf(ciId, conn = db) {
  const { rows } = await conn.query(
    `SELECT sr.row_key, sr.type, sr.post_id, sr.outside, sr.added_round
       FROM content_social_rows sr JOIN collab_content cc ON cc.id = sr.content_id
      WHERE cc.campaign_influencer_id = $1 AND sr.removed_round IS NULL
      ORDER BY sr.created_at, sr.row_key`, [ciId]);
  return rows.map((x) => ({
    key: x.row_key, type: x.type, count: 1,
    label: SALE_TYPES[x.type].label, platform: SALE_TYPES[x.type].platform, isStory: x.type === 'story',
    postId: x.post_id, outside: !!x.outside, addedRound: x.added_round,
  }));
}

/** When the shoot was done — "Shoot done on {date}" (C1). One vocabulary for both modes. */
function shootDoneAt(r) {
  if (!r || r.pe_status !== 'completed') return null;
  if (String(r.pe_mode || r.set_mode || '').toLowerCase() === 'visit') {
    return r.auto_confirmed_at || r.brand_completed_at || r.visit_completed_at || null;
  }
  return r.influencer_completed_at || null;
}

/**
 * Refuse unless the content step is open for this caller. Returns what every path needs next.
 * `conn` lets a transaction ask before it writes.
 */
async function assertContentOpen(ciId, scope, conn = db, { allowShootNotDone = false, allowOldTerms = false } = {}) {
  const r = await load(ciId, scope, conn);
  if (!r) throw new AppError('NOT_FOUND', 'Not found', 404);

  const gate = await shootGate.shootGate(ciId, conn);
  if (!gate) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!gate.signed.at) throw new AppError('NOT_SIGNED', MSG10.NOT_SIGNED, 422, 'status');
  if (!gate.open) throw new AppError('NOT_FUNDED', MSG10.NOT_FUNDED, 422, 'status');

  if (r.goal === PAY_FOR_SALE) return saleGate(ciId, r, gate, conn, { allowShootNotDone, allowOldTerms });
  if (r.goal !== PAY_FOR_CONTENT) throw new AppError('NOT_PAY_FOR_CONTENT', MSG.NOT_PAY_FOR_CONTENT, 404);

  const shootDone = r.pe_status === 'completed';
  if (!shootDone) {
    if (!allowShootNotDone) throw new AppError('SHOOT_NOT_DONE', MSG.SHOOT_NOT_DONE, 422, 'status');
    return { r, gate, rows: rowsOf(r.terms_json) || [], shootDone: false, shootDoneAt: null };
  }

  const rows = rowsOf(r.terms_json);
  if (!rows) throw new AppError('NO_ROWS', MSG.NO_ROWS, 422, 'status');
  return { r, gate, rows, shootDone: true, shootDoneAt: shootDoneAt(r) };
}

/**
 * Item 14 — the Pay for Sale arm of the gate. `aim: 'sale'` travels with the answer so every
 * caller can branch on it without re-reading the set.
 */
async function saleGate(ciId, r, gate, conn, { allowShootNotDone, allowOldTerms }) {
  if (!r.sell_v2) {
    if (!allowOldTerms) throw new AppError('OLD_TERMS', MSG.SALE_OLD_TERMS, 422, 'status');
    return { r, gate, rows: [], shootDone: r.pe_status === 'completed', shootDoneAt: shootDoneAt(r), aim: 'sale', oldTerms: true };
  }
  const shootDone = r.pe_status === 'completed';
  if (!shootDone && !allowShootNotDone) throw new AppError('SHOOT_NOT_DONE', MSG.SHOOT_NOT_DONE, 422, 'status');
  return { r, gate, rows: shootDone ? await saleRowsOf(ciId, conn) : [], shootDone, shootDoneAt: shootDoneAt(r), aim: 'sale', oldTerms: false };
}

module.exports = { assertContentOpen, load, rowsOf, saleRowsOf, shootDoneAt, PAY_FOR_CONTENT, PAY_FOR_SALE, SELECT };
