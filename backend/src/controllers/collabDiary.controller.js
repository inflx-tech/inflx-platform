'use strict';

/**
 * collabDiary.controller.js — "what happened here", readable at last.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * Every ask, counter and acceptance has been written down since migration 152. Nothing
 * could ever read it back — no route, no controller, no client. So the record that
 * exists to settle "what did we actually agree" has never been shown to either party.
 *
 * The screen this serves is the same page on both phones, word for word. That is the
 * whole point: two internally-consistent stories about one negotiation is precisely the
 * failure a shared diary prevents.
 *
 *   GET /v1/collab-diary/request/:id      — a brand -> creator conversation
 *   GET /v1/collab-diary/proposal/:id     — a creator -> brand pitch
 *
 * Both sides of a conversation get the identical payload. Access is proved from the
 * record itself: the brand that sent it, or the creator it was sent to, and nobody else.
 */

const db = require('../config/db');
const events = require('../services/collabEvents.service');
const terms = require('../services/collabTerms.model');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/** The caller's brand id and influencer id, whichever they have. */
async function callerIdentity(userId) {
  const { rows } = await db.query(
    `SELECT
       (SELECT id FROM brands      WHERE user_id = $1) AS brand_id,
       (SELECT id FROM influencers WHERE user_id = $1) AS influencer_id`,
    [userId]
  );
  return rows[0] || {};
}

/**
 * Turn stored rows into what the page reads.
 *
 * `changed` is deliberately passed through as { field: { from, to } } rather than
 * flattened to a sentence. The screen renders "15% -> 22%", and an entry that only says
 * "countered" is not worth reading — so the shape that carries the movement is the shape
 * the client gets.
 */
function toEntries(rows) {
  return rows.map((r) => ({
    id: r.id,
    step: r.step,
    action: r.action,
    who: r.actor_role,              // brand · creator · admin · system
    at: r.created_at,
    changed: r.changed || null,
    terms: r.terms_snapshot || null,
    note: r.note || null,
    round_of: r.round_of,
    round_max: r.round_max,
  }));
}

// ─── GET /v1/collab-diary/request/:id ────────────────────────────────────────
const requestDiary = asyncHandler(async (req, res) => {
  const me = await callerIdentity(req.user.sub);

  const { rows } = await db.query(
    `SELECT r.*, b.business_name, i.instagram_handle, u.name AS creator_name
       FROM brand_collab_requests r
       JOIN brands b      ON b.id = r.brand_id
       JOIN influencers i ON i.id = r.influencer_id
       JOIN users u       ON u.id = i.user_id
      WHERE r.id = $1`,
    [req.params.id]
  );
  const record = rows[0];
  if (!record) throw new AppError('NOT_FOUND', 'Conversation not found', 404);

  // Either side of this conversation, and nobody else. A 404 rather than a 403 so a
  // stranger cannot use the response to learn that the conversation exists.
  const mine = (me.brand_id && record.brand_id === me.brand_id)
            || (me.influencer_id && record.influencer_id === me.influencer_id);
  if (!mine) throw new AppError('NOT_FOUND', 'Conversation not found', 404);

  const entries = await events.list({ requestId: record.id });

  return success(res, {
    conversation: {
      kind: 'request',                       // the brand asked
      id: record.id,
      status: record.status,
      brand_name: record.business_name,
      creator_name: record.creator_name,
      creator_handle: record.instagram_handle,
      settled: record.counter_terms_json
        ? terms.settle(record.terms_json, record.counter_terms_json)
        : record.terms_json,
      settled_at: record.responded_at,
      expires_at: record.expires_at,
    },
    entries: toEntries(entries),
  });
});

// ─── GET /v1/collab-diary/proposal/:id ───────────────────────────────────────
const proposalDiary = asyncHandler(async (req, res) => {
  const me = await callerIdentity(req.user.sub);

  const { rows } = await db.query(
    `SELECT p.*, b.business_name, i.instagram_handle, u.name AS creator_name
       FROM influencer_proposals p
       JOIN brands b      ON b.id = p.brand_id
       JOIN influencers i ON i.id = p.influencer_id
       JOIN users u       ON u.id = i.user_id
      WHERE p.id = $1`,
    [req.params.id]
  );
  const record = rows[0];
  if (!record) throw new AppError('NOT_FOUND', 'Conversation not found', 404);

  const mine = (me.brand_id && record.brand_id === me.brand_id)
            || (me.influencer_id && record.influencer_id === me.influencer_id);
  if (!mine) throw new AppError('NOT_FOUND', 'Conversation not found', 404);

  const entries = await events.list({ proposalId: record.id });

  return success(res, {
    conversation: {
      kind: 'proposal',                      // the creator pitched
      id: record.id,
      status: record.status,
      brand_name: record.business_name,
      creator_name: record.creator_name,
      creator_handle: record.instagram_handle,
      // A pitch does not carry a single terms blob the way a request does — its
      // opening offer lives in named columns, and only a counter is stored as JSON.
      // Verified against production 2026-08-22; assuming a `terms` column here would
      // have returned undefined and shown the creator an empty page.
      settled: record.counter_terms || {
        money: {
          fee: record.proposed_fee,
          commission_pct: record.proposed_commission_pct,
        },
        time: {
          window_start: record.proposed_posting_window_start,
          window_end: record.proposed_posting_window_end,
        },
      },
      settled_at: record.brand_response_at || null,
    },
    entries: toEntries(entries),
  });
});

module.exports = { requestDiary, proposalDiary };
