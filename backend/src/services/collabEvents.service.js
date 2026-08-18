'use strict';

/**
 * collabEvents.service.js — the collaboration diary.
 * Contract: features/collab-phase0-foundations  (Phase 0)
 *
 * WHAT THIS FIXES
 * A negotiation used to leave no trace. Kanchi Silks asks 15%, Asha counters 22%,
 * Kanchi counters 18%, Asha accepts — and afterwards only 18% survives, because
 * counter_terms_json holds THE LATEST counter and each one overwrites the last.
 * A month later nobody can answer "didn't they originally give me more time?".
 *
 * The same hole existed on shop posts (only the last rejection reason survived) and
 * on reels (only the last change request). The shoot was the sole exception — it has
 * recorded every action since migration 024, which is why it is the only step that
 * can settle an argument. This generalises that to all six steps.
 *
 * TWO RULES THAT MAKE IT WORTH READING
 *   1. An entry records WHAT CHANGED, not that something did. "15% → 22%" is the
 *      information; "countered" is not. That is the `changed` field.
 *   2. Both parties read the identical entry. There is no per-side copy and no
 *      per-side wording — a diary that says different things to two people cannot
 *      settle anything.
 *
 * THE HARD RULE — writing must never break the thing it describes.
 * A missing history line is a nuisance. A counter that failed to send because its
 * history line threw is a defect. Every write is wrapped; failures warn and continue.
 * Callers must not await this for correctness.
 */

const db = require('../config/db');

// The six steps, named so callers read as prose rather than magic numbers.
const STEP = {
  AGREE:     1,   // terms: asked, countered, accepted, declined, expired
  SIGN:      2,   // campaign invite, creator signs, brand countersigns
  SHOOT:     3,   // slot, parcel, receipt, done
  SHOP_POSTS:4,   // submitted, sent back, resubmitted, approved, live
  GO_LIVE:   5,   // reel submitted, changes asked, approved, posted, confirmed
  COMPLETE:  6,   // each completion condition as it is met
};

const ROLES = ['brand', 'creator', 'admin', 'system'];
const ANCHORS = ['request_id', 'proposal_id', 'agreement_id', 'campaign_influencer_id', 'post_id'];

/**
 * Build a `changed` object from a before/after pair of flat term maps.
 * Only keys that actually moved are included — an entry listing eight unchanged
 * fields buries the one that matters.
 *
 * diffTerms({ commission_pct: 15, post_by: '2026-08-24' },
 *           { commission_pct: 22, post_by: '2026-09-02' })
 *   → { commission_pct: { from: 15, to: 22 }, post_by: { from: '2026-08-24', to: '2026-09-02' } }
 */
function diffTerms(before, after) {
  const a = before && typeof before === 'object' ? before : {};
  const b = after && typeof after === 'object' ? after : {};
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const from = a[k];
    const to = b[k];
    // JSON compare so nested shapes (money, time, scope) diff correctly and
    // 15 vs '15' does not read as a change.
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
    out[k] = { from: from ?? null, to: to ?? null };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Record one thing that happened.
 *
 * NEVER THROWS. A diary failure must not take down the action it was describing.
 * Returns the row on success and null on failure, so a caller that genuinely wants
 * to know can check — but no caller should branch on it.
 *
 * @param {object}  e
 * @param {string}  [e.requestId]              anchor — brand_collab_requests
 * @param {string}  [e.proposalId]             anchor — influencer_proposals
 * @param {string}  [e.agreementId]            anchor — collab_agreements
 * @param {string}  [e.campaignInfluencerId]   anchor — campaign_influencers
 * @param {string}  [e.postId]                 anchor — creator_posts. A shop post has no
 *                                             collaboration of its own: it may span brands.
 * @param {number}  e.step                     1..6, use STEP.*
 * @param {string}  e.actorRole                brand | creator | admin | system
 * @param {string}  [e.actorUserId]
 * @param {string}  e.action                   short verb, e.g. 'countered'
 * @param {object}  [e.termsSnapshot]          terms as they stand AFTER this action
 * @param {object}  [e.changed]                { field: { from, to } }
 * @param {string}  [e.note]                   decline reason, rejection fault, message
 * @param {number}  [e.roundOf]                this side's round number, 1-based
 * @param {number}  [e.roundMax]               rounds allowed per side
 * @param {object}  [e.meta]
 * @param {object}  [client]                   pg client, to join a caller's transaction
 */
async function record(e, client) {
  try {
    if (!e || typeof e !== 'object') return null;

    const anchors = {
      request_id:             e.requestId || null,
      proposal_id:            e.proposalId || null,
      agreement_id:           e.agreementId || null,
      campaign_influencer_id: e.campaignInfluencerId || null,
      post_id:                e.postId || null,
    };
    if (!ANCHORS.some(k => anchors[k])) {
      console.warn('[collabEvents] refused: no anchor', e.action);
      return null;
    }
    if (!Number.isInteger(e.step) || e.step < 1 || e.step > 6) {
      console.warn('[collabEvents] refused: bad step', e.step, e.action);
      return null;
    }
    if (!ROLES.includes(e.actorRole)) {
      console.warn('[collabEvents] refused: bad actor role', e.actorRole);
      return null;
    }
    if (!e.action) {
      console.warn('[collabEvents] refused: no action');
      return null;
    }

    const exec = client || db;
    const { rows } = await exec.query(
      `INSERT INTO collab_events
         (request_id, proposal_id, agreement_id, campaign_influencer_id, post_id,
          step, actor_role, actor_user_id, action,
          terms_snapshot, changed, note, round_of, round_max, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15::jsonb)
       RETURNING *`,
      [
        anchors.request_id, anchors.proposal_id, anchors.agreement_id, anchors.campaign_influencer_id,
        anchors.post_id,
        e.step, e.actorRole, e.actorUserId || null, e.action,
        e.termsSnapshot ? JSON.stringify(e.termsSnapshot) : null,
        e.changed ? JSON.stringify(e.changed) : null,
        e.note || null,
        Number.isInteger(e.roundOf) ? e.roundOf : null,
        Number.isInteger(e.roundMax) ? e.roundMax : null,
        JSON.stringify(e.meta || {}),
      ]
    );
    return rows[0] || null;
  } catch (err) {
    // Deliberate: the diary is never allowed to break the action it describes.
    console.warn('[collabEvents] write failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Read a diary, oldest first — the order it happened, which is the order it reads.
 *
 * Pass any combination of anchors; entries matching ANY of them are returned, so a
 * thread that ran request → agreement → campaign_influencer reads as one story.
 * Optionally narrow to a single step.
 */
async function list({ requestId, proposalId, agreementId, campaignInfluencerId, postId, step } = {}) {
  const where = [];
  const params = [];
  const add = (col, val) => { params.push(val); where.push(`${col} = $${params.length}`); };

  if (requestId)            add('request_id', requestId);
  if (proposalId)           add('proposal_id', proposalId);
  if (agreementId)          add('agreement_id', agreementId);
  if (campaignInfluencerId) add('campaign_influencer_id', campaignInfluencerId);
  if (postId)               add('post_id', postId);
  if (!where.length) return [];

  let sql = `SELECT * FROM collab_events WHERE (${where.join(' OR ')})`;
  if (Number.isInteger(step)) {
    params.push(step);
    sql += ` AND step = $${params.length}`;
  }
  sql += ` ORDER BY created_at ASC, id ASC`;

  const { rows } = await db.query(sql, params);
  return rows;
}

module.exports = { STEP, ROLES, record, list, diffTerms };
