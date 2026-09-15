'use strict';

/**
 * handshake.service.js — the pre-campaign handshake, both directions.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * Stage 1 of the two-stage model. A brand and a creator agree the terms that matter
 * BEFORE anyone builds a campaign, because — founder — "if brand creates campaign
 * without knowing their interest is waste of energy".
 *
 * TWO RECORD TYPES, ONE SET OF RULES.
 *   brand_collab_requests  — brand → creator. New; did not exist in any form.
 *   influencer_proposals   — creator → brand. Already built; untouched here.
 * A pitch says "I want to work with you"; a request says "I want you for something".
 * Separate records, never converted into one another, but they share the terms model
 * (collabTerms.model), the response flow, and the agreement they produce.
 *
 * WHAT ACCEPTANCE PRODUCES. An AGREEMENT — not a campaign. The old path fabricated a
 * campaign + set + assignment + contract because it had nowhere else to put the
 * result, which is why one-person dateless campaigns exist in production. An agreement
 * is one brand with one creator, consumed when briefed, expiring if it never is.
 *
 * Every limit comes from handshakeSettings, never a constant here.
 */

const db = require('../config/db');
const settings = require('./handshakeSettings.service');
const terms = require('./collabTerms.model');

const ACTIVE_REQUEST_STATUSES = ['sent', 'viewed', 'countered'];

const deny = (reason, field) => ({ eligible: false, reason, field });
const ALLOW = { eligible: true };

// ── Eligibility: brand → creator ────────────────────────────────────────────

// ── Creating requests ───────────────────────────────────────────────────────

// ── Responding ──────────────────────────────────────────────────────────────

// ── Bridging the creator pitch ───────────────────────────────────────────────

/**
 * Map a creator pitch's flat columns into the shared terms shape.
 *
 * influencer_proposals is deliberately NOT restructured — it works and it is in use.
 * So the flat columns stay as storage and this is the single boundary where they become
 * terms. Both record types then obey one set of rules without a second table.
 *
 * The pitch's `goal` column already uses the campaign_goal enum, which is exactly why
 * the terms model was aligned to that vocabulary rather than inventing its own — no
 * translation needed here.
 */
function termsFromProposal(p, counterTerms = null) {
  const src = counterTerms && typeof counterTerms === 'object' ? counterTerms : {};
  const aim = String(src.goal || p.goal || '').toLowerCase();

  const commission = src.proposed_commission_pct ?? p.proposed_commission_pct;
  const fee = src.proposed_fee ?? p.proposed_fee;
  const wStart = src.proposed_posting_window_start ?? p.proposed_posting_window_start;
  const wEnd = src.proposed_posting_window_end ?? p.proposed_posting_window_end;
  const deliverables = src.proposed_deliverables ?? p.proposed_deliverables;

  const money = {};
  if (commission != null) money.commission_pct = Number(commission);
  if (fee != null) money.fee = Number(fee);

  // ONE date, whatever the aim — she must have posted by then, and the campaign starts
  // then. The window's END was always the date she actually committed to; the start was
  // never a commitment, only a hint about when she might begin.
  //
  // This branch used to emit a window for a paid collaboration. Since the terms model now
  // refuses windows, leaving it would have made ACCEPTING a pay-for-content pitch fail
  // validation — a break that no screen would have explained.
  // Contract: features/collab-terms-by-aim (item 3)
  const time = { post_by: wEnd || wStart };

  const out = { aim, money, time };

  const level = String(p.scope_level || '').toLowerCase();
  if (level) {
    const ref = p.scope_ref_json || {};
    const productIds = Array.isArray(p.proposed_product_ids) ? p.proposed_product_ids : null;
    out.scope =
      level === 'category' ? { level, category_node_id: ref.category_node_id || null, category: ref.category || null }
      : level === 'product' || level === 'products' ? { level: 'products', product_ids: productIds || ref.product_ids || [] }
      : { level: 'store' };
    // A creator naming what they want to promote is stating an intent, not issuing an
    // ultimatum — so it is a preference the brand can answer.
    out.importance = { ...(out.importance || {}), scope: 'preference' };
  }

  if (Array.isArray(deliverables) && deliverables.length) {
    out.deliverables = deliverables;
    out.importance = { ...(out.importance || {}), deliverables: 'preference' };
  }

  return out;
}

// ── Agreements ──────────────────────────────────────────────────────────────

/**
 * Mark an agreement consumed. One agreement is one collaboration, used once — so
 * Ready to brief always shows exactly what is outstanding. Several agreements can
 * still be briefed into ONE campaign across its sets.
 */
async function consumeAgreement({ agreementId, campaignId, ciId, tx = db }) {
  const { rows } = await tx.query(
    `UPDATE collab_agreements
        SET status = 'consumed', consumed_campaign_id = $2, consumed_ci_id = $3,
            consumed_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'ready'
      RETURNING *`,
    [agreementId, campaignId, ciId]
  );
  if (!rows[0]) {
    // Already consumed, expired or cancelled. Refusing loudly beats briefing the same
    // agreement into two campaigns.
    const e = new Error('That agreement is no longer available to brief.');
    e.kind = 'validation'; throw e;
  }
  return rows[0];
}

/** Lapse agreements never briefed. Founder: three months. */
async function expireStaleAgreements() {
  const { rows } = await db.query(
    `UPDATE collab_agreements SET status = 'expired', updated_at = now()
      WHERE status = 'ready' AND expires_at <= now()
      RETURNING id`
  );
  if (rows.length) console.log(`[handshake] expired ${rows.length} unbriefed agreement(s)`);
  return rows.length;
}

/** Expire unanswered requests so they stop occupying an active slot on either side. */
async function expireStaleRequests() {
  const { rows } = await db.query(
    `UPDATE brand_collab_requests SET status = 'expired', updated_at = now()
      WHERE status = ANY($1::text[]) AND expires_at <= now()
      RETURNING id`,
    [ACTIVE_REQUEST_STATUSES]
  );
  if (rows.length) console.log(`[handshake] expired ${rows.length} unanswered request(s)`);
  return rows.length;
}

/**
 * Item 8 — the dead half of this file is gone (gap report §6, step 6).
 *
 * Nine exports had no caller left once the pitch got item 6’s thread and the
 * brief path closed: the brand-request door (create, preview, eligibility,
 * get, counter, decline), its per-side counter cap — the last reader of
 * handshake_settings.counter_rounds_per_side — and the two collab_agreements
 * entry points. `brand_collab_requests` was already unreachable from any route.
 *
 * What stays has live callers: the terms shape proposal.service reads, the
 * agreement consumed by an already-briefed invitation, and the two expiry
 * sweeps the hourly job runs over the rows that already exist.
 */
module.exports = {
  ACTIVE_REQUEST_STATUSES,
  termsFromProposal,
  consumeAgreement,
  expireStaleAgreements,
  expireStaleRequests,
};
