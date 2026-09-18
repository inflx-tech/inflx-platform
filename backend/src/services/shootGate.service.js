'use strict';

/**
 * shootGate.service.js — may this collaboration reach the shoot?
 * Contract: features/item10-store-visit · rules v1.24 §10, §11.1 · gap report §3.5
 *
 * §10 has said since the first version of the rules that the brand must be prevented from
 * reaching the shoot until the agreement is signed by both AND, for Pay for Content and
 * Hybrid, the funds are locked and the first 25% released. Until item 10 nothing enforced the
 * money half anywhere, and the signature half was checked on two paths of eighteen.
 *
 * ONE definition, read by every path. The signature test is item 7's — the two timestamps,
 * never contracts.status, because four seeded rows are 'active' with no signatures at all.
 * The funded test is what brandSignInTx actually writes: money_at stamped, locked_amount > 0,
 * three escrow rows, tranche 1 released. Pay for Sale has no fixed money and no funding gate.
 *
 * A paid collaboration with nothing locked is BLOCKED whatever its age (founder Q4): it cannot
 * arise through item 5, none exists, and if one ever appears the founder wants to hear about it
 * rather than have the shoot quietly open.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { MSG } = require('./productionCopy');

const GATE_SQL = `
  SELECT ci.id AS ci_id, cs.goal, cs.shoot_mode, cs.go_live_date, cs.branch_id,
         con.id AS contract_id, con.influencer_signed_at, con.brand_signed_at,
         con.locked_amount, con.released_amount, con.money_at,
         (SELECT count(*)::int FROM escrow_entries e WHERE e.campaign_influencer_id = ci.id) AS escrow_rows,
         (SELECT e.released_at FROM escrow_entries e
           WHERE e.campaign_influencer_id = ci.id AND e.tranche_number = 1 AND e.status = 'released'
           LIMIT 1) AS t1_released_at
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id`;

/** Turn the row into the answer. Pure, so a test can hand it a shape. */
function decide(r) {
  if (!r) return null;
  const signed = !!(r.influencer_signed_at && r.brand_signed_at);
  // Pay for Content and Hybrid carry fixed money. A set with no goal (pre-set-first) is judged
  // by whether anything was locked: nothing locked, nothing to wait for.
  const needsMoney = r.goal === 'engagement' || r.goal === 'hybrid' || Number(r.locked_amount || 0) > 0;
  const funded = !needsMoney || (
    r.money_at != null
    && Number(r.locked_amount || 0) > 0
    && Number(r.escrow_rows) === 3
    && r.t1_released_at != null
  );
  return {
    open: signed && funded,
    reason: !signed ? 'NOT_SIGNED' : !funded ? 'NOT_FUNDED' : null,
    signed: { at: signed ? r.brand_signed_at : null, creatorAt: r.influencer_signed_at || null, brandAt: r.brand_signed_at || null },
    money: needsMoney
      ? { required: true, locked: Number(r.locked_amount || 0), released: Number(r.released_amount || 0), releasedAt: r.t1_released_at || null }
      : { required: false, locked: 0, released: 0, releasedAt: null },
    goal: r.goal || null,
    shootMode: r.shoot_mode || null,
    goLiveDate: r.go_live_date || null,
    branchId: r.branch_id || null,
    contractId: r.contract_id || null,
    ciId: r.ci_id,
  };
}

/** The gate for one collaboration. `conn` lets a transaction ask before it commits. */
async function shootGate(ciId, conn = db) {
  const { rows } = await conn.query(`${GATE_SQL} WHERE ci.id = $1`, [ciId]);
  return decide(rows[0]);
}

/** The gate for many at once — for lists, so a page of shoots is one round trip. */
async function shootGateMany(ciIds, conn = db) {
  const out = new Map();
  if (!ciIds || !ciIds.length) return out;
  const { rows } = await conn.query(`${GATE_SQL} WHERE ci.id = ANY($1::uuid[])`, [ciIds]);
  for (const r of rows) out.set(r.ci_id, decide(r));
  return out;
}

async function ciIdOfContract(contractId, conn = db) {
  const { rows } = await conn.query(`SELECT campaign_influencer_id FROM contracts WHERE id = $1`, [contractId]);
  return rows[0] ? rows[0].campaign_influencer_id : null;
}

function refuse(g) {
  if (!g) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!g.signed.at) throw new AppError('NOT_SIGNED', MSG.NOT_SIGNED, 422, 'status');
  if (!g.open) throw new AppError('NOT_FUNDED', MSG.NOT_FUNDED, 422, 'status');
  return g;
}

/** Refuse unless the gate is open. Returns the gate so the caller can reuse it. */
async function assertShootOpen(contractId, conn = db) {
  const ciId = await ciIdOfContract(contractId, conn);
  if (!ciId) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  return refuse(await shootGate(ciId, conn));
}

/** Same, addressed by the collaboration rather than the contract. */
async function assertShootOpenForCollab(ciId, conn = db) {
  return refuse(await shootGate(ciId, conn));
}

/** Same, addressed by the shoot row — the event-scoped routes. */
async function assertShootOpenForEvent(eventId, conn = db) {
  const { rows } = await conn.query(`SELECT contract_id FROM production_events WHERE id = $1`, [eventId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Production event not found', 404);
  return assertShootOpen(rows[0].contract_id, conn);
}

module.exports = { shootGate, shootGateMany, assertShootOpen, assertShootOpenForCollab, assertShootOpenForEvent, decide, GATE_SQL };
