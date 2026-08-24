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

/**
 * May this brand send this creator a request right now?
 *
 * Mirrors the creator-side eligibility that already exists, with one deliberate
 * asymmetry: creators are reachable BY DEFAULT and can mute, whereas brands opt in to
 * being pitched. The two sides are not in the same position — a brand not looking for
 * creators should not be pitched, but a creator who cannot be found cannot get work.
 */
async function brandRequestEligibility(brandId, influencerId, proposedTerms) {
  const cfg = await settings.get();

  const { rows: infRows } = await db.query(
    `SELECT i.id, i.accepts_brand_requests, i.min_commission_pct, i.min_fee, i.accepted_aims,
            u.status AS user_status
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE i.id = $1`,
    [influencerId]
  );
  const inf = infRows[0];
  if (!inf) return deny('Creator not found');
  if (inf.user_status !== 'approved') return deny('This creator is not active on the platform yet.');

  // The creator's mute. They are TOLD rather than silently ignored.
  if (inf.accepts_brand_requests === false) {
    return deny('This creator is not accepting collaboration requests right now.');
  }

  // Their own bar. A request below it cannot be sent, and the brand learns why.
  const aim = String(proposedTerms?.aim || '').toLowerCase();
  if (Array.isArray(inf.accepted_aims) && inf.accepted_aims.length && !inf.accepted_aims.includes(aim)) {
    return deny(`This creator only takes ${inf.accepted_aims.join(' / ')} collaborations.`, 'terms.aim');
  }
  if (inf.min_commission_pct != null && proposedTerms?.money?.commission_pct != null
      && Number(proposedTerms.money.commission_pct) < Number(inf.min_commission_pct)) {
    return deny(`This creator's minimum commission is ${inf.min_commission_pct}%.`, 'terms.money.commission_pct');
  }
  if (inf.min_fee != null && proposedTerms?.money?.fee != null
      && Number(proposedTerms.money.fee) < Number(inf.min_fee)) {
    return deny(`This creator's minimum fee is ₹${inf.min_fee}.`, 'terms.money.fee');
  }

  // Cooldown after they declined this brand.
  const { rows: cd } = await db.query(
    `SELECT cooldown_until FROM brand_request_cooldowns
      WHERE brand_id = $1 AND influencer_id = $2 AND cooldown_until > now()`,
    [brandId, influencerId]
  );
  if (cd[0]) {
    return deny(`This creator declined recently. You can ask again after ${new Date(cd[0].cooldown_until).toLocaleDateString('en-IN')}.`);
  }

  // One live conversation at a time with the same creator.
  const { rows: dup } = await db.query(
    `SELECT 1 FROM brand_collab_requests
      WHERE brand_id = $1 AND influencer_id = $2 AND status = ANY($3::text[])`,
    [brandId, influencerId, ACTIVE_REQUEST_STATUSES]
  );
  if (dup[0]) return deny('You already have an open request with this creator.');

  // An unconsumed agreement means they have already agreed — brief them instead.
  const { rows: agr } = await db.query(
    `SELECT 1 FROM collab_agreements
      WHERE brand_id = $1 AND influencer_id = $2 AND status = 'ready'`,
    [brandId, influencerId]
  );
  if (agr[0]) return deny('You already have an agreement with this creator — brief them into a campaign instead.');

  // Volume caps, from settings.
  const { rows: counts } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = ANY($2::text[]))                        AS active,
       COUNT(*) FILTER (WHERE created_at > now() - interval '1 day')           AS today,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')          AS this_week
     FROM brand_collab_requests WHERE brand_id = $1`,
    [brandId, ACTIVE_REQUEST_STATUSES]
  );
  const c = counts[0] || {};
  if (Number(c.active) >= cfg.brand_max_active) {
    return deny(`You have ${c.active} open requests. Wait for some to resolve before sending more.`);
  }
  if (Number(c.today) >= cfg.brand_max_per_day) {
    return deny(`You have reached today's limit of ${cfg.brand_max_per_day} new requests.`);
  }
  if (Number(c.this_week) >= cfg.brand_max_per_week) {
    return deny(`You have reached this week's limit of ${cfg.brand_max_per_week} new requests.`);
  }

  return ALLOW;
}

// ── Creating requests ───────────────────────────────────────────────────────

/**
 * Create one request. Terms are validated by the shared model first, so an invalid
 * payload never reaches eligibility (and a brand is not told "you are over your limit"
 * about a request that was malformed anyway).
 */
async function createBrandRequest({ brandId, influencerId, termsJson, message, origin = 'direct', groupId = null, batchId = null }) {
  const shape = terms.validateTerms(termsJson);
  if (!shape.ok) { const e = new Error(shape.message); e.field = shape.field; e.kind = 'validation'; throw e; }

  const gate = await brandRequestEligibility(brandId, influencerId, termsJson);
  if (!gate.eligible) { const e = new Error(gate.reason); e.field = gate.field; e.kind = 'blocked'; throw e; }

  const cfg = await settings.get();
  const expires = new Date(Date.now() + cfg.request_ttl_days * 86400 * 1000);

  const { rows } = await db.query(
    `INSERT INTO brand_collab_requests
       (brand_id, influencer_id, terms_json, message, origin, origin_group_id, broadcast_batch_id, expires_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
     RETURNING *`,
    [brandId, influencerId, JSON.stringify(termsJson), message || null, origin, groupId, batchId, expires]
  );
  return rows[0];
}

/**
 * Who a filter-matched broadcast would actually reach.
 *
 * Returns matched vs reachable vs capped, so the brand is told the truth rather than
 * assuming everyone matched got it. Founder: a broadcast is a ONE-TIME SNAPSHOT — it
 * matches once and sends. Standing recruitment belongs to open sales campaigns.
 */
async function previewBroadcast(brandId, filters = {}) {
  const cfg = await settings.get();

  // Params are pushed once and their index reused where a clause needs the same value
  // twice (city checks two columns, niche checks two arrays). An earlier version tried
  // to patch placeholder numbers with regexes after the fact — unreadable and wrong.
  const params = [];
  const push = (val) => { params.push(val); return `$${params.length}`; };
  const where = [`u.status = 'approved'`];

  if (Array.isArray(filters.tiers) && filters.tiers.length) {
    where.push(`i.tier = ANY(${push(filters.tiers)}::text[])`);
  }
  if (Array.isArray(filters.cities) && filters.cities.length) {
    const p = push(filters.cities);
    where.push(`(lower(i.city) = ANY(SELECT lower(x) FROM unnest(${p}::text[]) x)
              OR lower(u.city) = ANY(SELECT lower(x) FROM unnest(${p}::text[]) x))`);
  }
  if (Array.isArray(filters.niches) && filters.niches.length) {
    // Secondary niche is OR'd with primary, matching the existing open-group matcher —
    // a creator whose secondary niche fits should not be invisible to a broadcast.
    const p = push(filters.niches);
    where.push(`(EXISTS (SELECT 1 FROM unnest(i.niche) n
                          WHERE lower(n) = ANY(SELECT lower(x) FROM unnest(${p}::text[]) x))
              OR EXISTS (SELECT 1 FROM unnest(i.secondary_niche) n
                          WHERE lower(n) = ANY(SELECT lower(x) FROM unnest(${p}::text[]) x)))`);
  }
  if (filters.min_er != null && filters.min_er !== '') {
    where.push(`i.view_based_er >= ${push(Number(filters.min_er))}`);
  }
  if (filters.gender && filters.gender !== 'any') {
    where.push(`lower(i.gender) = lower(${push(filters.gender)})`);
  }

  const matchWhere = where.join(' AND ');

  // Snapshot: `params` is appended to below for the second query, and handing a shared
  // mutable array to an async call is a footgun waiting for someone to reorder these.
  const { rows: matchedRows } = await db.query(
    `SELECT count(*)::int AS n FROM influencers i JOIN users u ON u.id = i.user_id WHERE ${matchWhere}`,
    [...params]
  );
  const matched = matchedRows[0].n;

  // Reachable = matched, minus creators who muted brand requests, opted out of bulk
  // outreach specifically, are in cooldown with this brand, or already have an open
  // request from them.
  const pBrand = push(brandId);
  const pStatuses = push(ACTIVE_REQUEST_STATUSES);
  const pLimit = push(cfg.broadcast_max_recipients);

  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.followers_count, i.tier
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE ${matchWhere}
        AND i.accepts_brand_requests = true
        AND i.include_in_broadcasts  = true
        AND NOT EXISTS (SELECT 1 FROM brand_request_cooldowns bc
                         WHERE bc.brand_id = ${pBrand} AND bc.influencer_id = i.id
                           AND bc.cooldown_until > now())
        AND NOT EXISTS (SELECT 1 FROM brand_collab_requests r
                         WHERE r.brand_id = ${pBrand} AND r.influencer_id = i.id
                           AND r.status = ANY(${pStatuses}::text[]))
      ORDER BY i.followers_count DESC NULLS LAST
      LIMIT ${pLimit}`,
    params
  );

  return {
    matched,
    reachable: rows.length,
    cap: cfg.broadcast_max_recipients,
    capped: matched > rows.length,
    recipients: rows,
  };
}

// ── Responding ──────────────────────────────────────────────────────────────

async function getRequest(id) {
  const { rows } = await db.query(`SELECT * FROM brand_collab_requests WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Counter a request. `side` is who is countering.
 *
 * Two counters each, then settle or drop — the same rule the campaign contract already
 * uses, so both negotiations feel the same. The shared model refuses a counter that
 * touches a REQUIREMENT.
 */
async function counterRequest({ requestId, side, counterTerms }) {
  const cfg = await settings.get();
  const req = await getRequest(requestId);
  if (!req) { const e = new Error('Request not found'); e.kind = 'notfound'; throw e; }
  if (!ACTIVE_REQUEST_STATUSES.includes(req.status)) {
    const e = new Error(`Cannot counter a request that is ${req.status}`); e.kind = 'validation'; throw e;
  }

  const usedField = side === 'brand' ? 'brand_rounds_used' : 'creator_rounds_used';
  if (Number(req[usedField]) >= cfg.counter_rounds_per_side) {
    const e = new Error(`You have used both of your ${cfg.counter_rounds_per_side} counters — settle or decline.`);
    e.kind = 'validation'; throw e;
  }

  // Counter against the LATEST terms on the table, not the original, so round two
  // answers round one rather than re-litigating the opening offer.
  const current = req.counter_terms_json ? terms.settle(req.terms_json, req.counter_terms_json) : req.terms_json;
  const check = terms.validateCounter(current, counterTerms);
  if (!check.ok) { const e = new Error(check.message); e.field = check.field; e.kind = 'validation'; throw e; }

  const { rows } = await db.query(
    `UPDATE brand_collab_requests
        SET status = 'countered',
            counter_terms_json = $2::jsonb,
            counter_by = $3,
            ${usedField} = ${usedField} + 1,
            responded_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [requestId, JSON.stringify(counterTerms), side]
  );
  return rows[0];
}

async function declineRequest({ requestId, side, reason }) {
  const cfg = await settings.get();
  const req = await getRequest(requestId);
  if (!req) { const e = new Error('Request not found'); e.kind = 'notfound'; throw e; }

  const { rows } = await db.query(
    `UPDATE brand_collab_requests
        SET status = 'declined', decline_reason = $2, responded_at = now(), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [requestId, reason || null]
  );

  // A creator declining starts the brand's cooldown, so they are not re-asked
  // immediately. A brand walking away from its own request does not penalise the
  // creator — they did nothing.
  if (side === 'creator') {
    const until = new Date(Date.now() + cfg.decline_cooldown_days * 86400 * 1000);
    await db.query(
      `INSERT INTO brand_request_cooldowns (brand_id, influencer_id, cooldown_until, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (brand_id, influencer_id)
       DO UPDATE SET cooldown_until = EXCLUDED.cooldown_until, reason = EXCLUDED.reason`,
      [req.brand_id, req.influencer_id, until, reason || 'declined']
    );
  }
  return rows[0];
}

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

/**
 * Can this pitch produce a valid agreement? Money and time are primary on both sides,
 * so a pitch missing either cannot be accepted into one.
 *
 * Called at pitch CREATION so the creator is told immediately, rather than at acceptance
 * where the brand would be blamed for the creator's incomplete form.
 */
function validateProposalTerms(p, counterTerms = null) {
  return terms.validateTerms(termsFromProposal(p, counterTerms));
}

// ── Agreements ──────────────────────────────────────────────────────────────

/**
 * Accept, and produce an AGREEMENT.
 *
 * This is the heart of the contract. The old path fabricated a campaign, a set, an
 * assignment and a contract draft — so the agreed creator never entered a real
 * campaign, and one-person dateless campaigns accumulated in production. Nothing
 * downstream is created here now.
 *
 * `source` is 'request' or 'proposal'. The table has a CHECK that exactly one source
 * is set, so an agreement can never lose track of where it came from.
 */
async function acceptIntoAgreement({ source, sourceId, brandId, influencerId, settledTerms }) {
  const cfg = await settings.get();
  const shape = terms.validateTerms(settledTerms);
  if (!shape.ok) { const e = new Error(shape.message); e.field = shape.field; e.kind = 'validation'; throw e; }

  const expires = new Date(Date.now() + cfg.agreement_expiry_days * 86400 * 1000);

  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO collab_agreements
         (brand_id, influencer_id, terms_json, source_request_id, source_proposal_id, expires_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        brandId, influencerId, JSON.stringify(settledTerms),
        source === 'request' ? sourceId : null,
        source === 'proposal' ? sourceId : null,
        expires,
      ]
    );

    if (source === 'request') {
      await tx.query(
        `UPDATE brand_collab_requests SET status = 'agreed', responded_at = now(), updated_at = now() WHERE id = $1`,
        [sourceId]
      );
    } else {
      await tx.query(`UPDATE influencer_proposals SET status = 'accepted', updated_at = now() WHERE id = $1`, [sourceId]);
    }

    return rows[0];
  });
}

/** Agreements waiting to be briefed — what campaign creation offers. */
async function listReadyToBrief(brandId) {
  const { rows } = await db.query(
    `SELECT a.*, i.instagram_handle, i.followers_count, i.profile_image_url, u.name AS influencer_name
       FROM collab_agreements a
       JOIN influencers i ON i.id = a.influencer_id
       JOIN users u       ON u.id = i.user_id
      WHERE a.brand_id = $1 AND a.status = 'ready' AND a.expires_at > now()
      ORDER BY a.created_at ASC`,
    [brandId]
  );
  return rows;
}

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

module.exports = {
  ACTIVE_REQUEST_STATUSES,
  termsFromProposal,
  validateProposalTerms,
  brandRequestEligibility,
  createBrandRequest,
  previewBroadcast,
  getRequest,
  counterRequest,
  declineRequest,
  acceptIntoAgreement,
  listReadyToBrief,
  consumeAgreement,
  expireStaleAgreements,
  expireStaleRequests,
};
