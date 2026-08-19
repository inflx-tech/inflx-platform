'use strict';

/**
 * proposal.service.js — Phase Q (Influencer Proposals)
 *
 * Eligibility checks, rate limits, state transitions for influencer-
 * initiated proposals to brands.
 */

const db = require('../config/db');
// collab-phase0: counter rounds are admin-set, shared with the brand→creator direction.
const settings = require('./handshakeSettings.service');
const terms = require('./collabTerms.model');
// Flat pitch columns -> the shared terms shape. handshake.service imports nothing from
// here, so this direction is safe.
const handshake = require('./handshake.service');

/** The terms currently on the table: the pitch, with the latest counter settled over it. */
function currentTermsOf(p) {
  const c = p.counter_terms
    ? (typeof p.counter_terms === 'string' ? JSON.parse(p.counter_terms) : p.counter_terms)
    : null;
  return handshake.termsFromProposal(p, c);
}

const PROPOSAL_TTL_DAYS = 7;
const COOLDOWN_DAYS_AFTER_REJECT = 30;

const RATE_LIMITS = {
  maxActivePerInfluencer:    5,
  maxNewPerDayPerInfluencer: 3,
  maxNewPerWeekPerInfluencer: 10,
};

const TIER_RANK = { nano: 1, micro: 2, macro: 3, mega: 4 };

// ─── Eligibility ────────────────────────────────────────────────────────────

/**
 * Whether `influencer` can pitch `brand` right now.
 * Returns { eligible: bool, reason?: string }.
 */
async function checkEligibility(influencerId, brandId) {
  const { rows: brandRows } = await db.query(
    `SELECT b.id, b.accepts_proposals, b.proposal_filters, u.city AS brand_city
     FROM   brands b
     JOIN   users u ON u.id = b.user_id
     WHERE  b.id = $1`,
    [brandId]
  );
  const brand = brandRows[0];
  if (!brand) return { eligible: false, reason: 'Brand not found' };
  if (!brand.accepts_proposals) {
    return { eligible: false, reason: 'This brand is not accepting proposals right now.' };
  }

  const { rows: infRows } = await db.query(
    `SELECT inf.id, inf.followers_count, inf.engagement_rate, inf.niche,
            inf.proposal_status, inf.proposal_banned_until,
            u.city AS influencer_city
     FROM   influencers inf
     JOIN   users u ON u.id = inf.user_id
     WHERE  inf.id = $1`,
    [influencerId]
  );
  const inf = infRows[0];
  if (!inf) return { eligible: false, reason: 'Influencer not found' };

  if (inf.proposal_status === 'banned') {
    return { eligible: false, reason: 'You are banned from sending proposals. Contact support.' };
  }
  if (inf.proposal_status === 'suspended' && inf.proposal_banned_until && new Date(inf.proposal_banned_until) > new Date()) {
    return {
      eligible: false,
      reason: `Suspended from proposals until ${new Date(inf.proposal_banned_until).toLocaleDateString('en-IN')}`,
    };
  }

  // Cooldown — has this brand recently rejected this influencer?
  const { rows: cdRows } = await db.query(
    `SELECT cooldown_until FROM proposal_cooldowns
     WHERE influencer_id = $1 AND brand_id = $2 AND cooldown_until > NOW()`,
    [influencerId, brandId]
  );
  if (cdRows[0]) {
    return {
      eligible: false,
      reason: `Cooldown active. You can pitch this brand again on ${new Date(cdRows[0].cooldown_until).toLocaleDateString('en-IN')}.`,
    };
  }

  // Brand-side filters
  const filters = brand.proposal_filters || {};

  if (filters.min_tier) {
    const myTier = tierFromFollowers(Number(inf.followers_count || 0));
    if ((TIER_RANK[myTier] || 0) < (TIER_RANK[filters.min_tier] || 0)) {
      return { eligible: false, reason: `This brand only accepts proposals from ${filters.min_tier} tier and above.` };
    }
  }
  if (Array.isArray(filters.allowed_niches) && filters.allowed_niches.length > 0) {
    const myNiches = Array.isArray(inf.niche) ? inf.niche.map(n => String(n).toLowerCase()) : [];
    const allowed = filters.allowed_niches.map(n => String(n).toLowerCase());
    const overlap = myNiches.some(n => allowed.includes(n));
    if (!overlap) {
      return { eligible: false, reason: `This brand only accepts proposals from these niches: ${filters.allowed_niches.join(', ')}.` };
    }
  }
  if (filters.city_match_required) {
    if (!inf.influencer_city || !brand.brand_city ||
        String(inf.influencer_city).toLowerCase() !== String(brand.brand_city).toLowerCase()) {
      return { eligible: false, reason: 'This brand only accepts proposals from influencers in the same city.' };
    }
  }
  if (filters.min_engagement_rate != null) {
    if (Number(inf.engagement_rate || 0) < Number(filters.min_engagement_rate)) {
      return { eligible: false, reason: `This brand requires a minimum engagement rate of ${filters.min_engagement_rate}%.` };
    }
  }
  if (filters.only_past_collabs) {
    const { rows: priorRows } = await db.query(
      `SELECT 1 FROM campaign_influencers ci
       JOIN   campaign_sets cs ON cs.id = ci.set_id
       JOIN   campaigns c ON c.id = cs.campaign_id
       WHERE  ci.influencer_id = $1 AND c.brand_id = $2
              AND ci.status IN ('active', 'completed')
       LIMIT  1`,
      [influencerId, brandId]
    );
    if (!priorRows[0]) {
      return { eligible: false, reason: 'This brand only accepts proposals from influencers they have worked with before.' };
    }
  }

  // Rate limits
  const { rows: countsRows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('sent','viewed','countered'))                             AS active_count,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')                            AS today_count,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')                              AS week_count
     FROM influencer_proposals
     WHERE influencer_id = $1`,
    [influencerId]
  );
  const c = countsRows[0];
  if (Number(c.active_count) >= RATE_LIMITS.maxActivePerInfluencer) {
    return { eligible: false, reason: `You have ${c.active_count} active proposals. Wait for some to resolve before sending more.` };
  }
  if (Number(c.today_count) >= RATE_LIMITS.maxNewPerDayPerInfluencer) {
    return { eligible: false, reason: `Daily limit reached (${RATE_LIMITS.maxNewPerDayPerInfluencer}). Try tomorrow.` };
  }
  if (Number(c.week_count) >= RATE_LIMITS.maxNewPerWeekPerInfluencer) {
    return { eligible: false, reason: `Weekly limit reached (${RATE_LIMITS.maxNewPerWeekPerInfluencer}). Try next week.` };
  }

  return { eligible: true };
}

function tierFromFollowers(n) {
  if (n < 10000)    return 'nano';
  if (n < 100000)   return 'micro';
  if (n < 1000000)  return 'macro';
  return 'mega';
}

// ─── Reads ──────────────────────────────────────────────────────────────────

async function getById(proposalId) {
  const { rows } = await db.query(
    `SELECT p.*,
            inf_u.name AS influencer_name, inf.instagram_handle AS influencer_handle,
            inf.followers_count, inf.engagement_rate, inf.niche AS influencer_niches,
            inf_u.city AS influencer_city,
            b.business_name AS brand_name
     FROM   influencer_proposals p
     JOIN   influencers inf ON inf.id = p.influencer_id
     JOIN   users inf_u ON inf_u.id = inf.user_id
     JOIN   brands b ON b.id = p.brand_id
     WHERE  p.id = $1`,
    [proposalId]
  );
  return rows[0] || null;
}

async function listForBrand(brandId, { status } = {}) {
  const params = [brandId];
  let where = 'p.brand_id = $1';
  if (status) {
    params.push(status);
    where += ` AND p.status = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT p.*,
            inf_u.name AS influencer_name, inf.instagram_handle AS influencer_handle,
            inf.followers_count, inf.engagement_rate, inf.niche AS influencer_niches,
            inf_u.city AS influencer_city
     FROM   influencer_proposals p
     JOIN   influencers inf ON inf.id = p.influencer_id
     JOIN   users inf_u ON inf_u.id = inf.user_id
     WHERE  ${where}
     ORDER  BY p.created_at DESC
     LIMIT  100`,
    params
  );
  return rows;
}

async function listForInfluencer(influencerId, { status } = {}) {
  const params = [influencerId];
  let where = 'p.influencer_id = $1';
  if (status) {
    params.push(status);
    where += ` AND p.status = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT p.*,
            b.business_name AS brand_name, b.logo_url AS brand_logo,
            b_u.city AS brand_city
     FROM   influencer_proposals p
     JOIN   brands b ON b.id = p.brand_id
     JOIN   users b_u ON b_u.id = b.user_id
     WHERE  ${where}
     ORDER  BY p.created_at DESC
     LIMIT  100`,
    params
  );
  return rows;
}

// Brands the influencer can pitch right now (after applying their own filters).
async function discoverEligibleBrands(influencerId, { search, category, city, limit = 30 } = {}) {
  const params = [influencerId];
  let q = `SELECT b.id, b.business_name, b.logo_url, b.category, b.proposal_filters,
                  u.city AS brand_city
           FROM   brands b
           JOIN   users u ON u.id = b.user_id
           WHERE  b.accepts_proposals = TRUE
             AND  u.status = 'approved'`;
  if (search) {
    params.push(`%${search}%`);
    q += ` AND b.business_name ILIKE ${params.length}`;
  }
  // collab-part6 §6.2 — category and city were already SELECTed and shown on every row;
  // only business_name was filterable, so a creator looking for fashion brands in their
  // city had to scroll and guess. The eligibility conditions above are untouched: these
  // filters narrow, never widen.
  if (category) {
    params.push(category);
    q += ` AND b.category = ${params.length}`;
  }
  if (city) {
    params.push(city);
    q += ` AND u.city = ${params.length}`;
  }
  params.push(Math.min(limit, 100));
  q += ` ORDER BY b.created_at DESC LIMIT $${params.length}`;

  const { rows } = await db.query(q, params);
  // Return all listed brands; eligibility is checked per-brand on submit.
  return rows;
}

/**
 * collab-part6 §6.2 — the industry and city values that actually have listed brands.
 * Derived from the same eligibility conditions as the list itself, so the app can never
 * offer a filter that returns nothing.
 */
async function discoveryFacets() {
  const { rows } = await db.query(
    `SELECT b.category, u.city
       FROM brands b
       JOIN users u ON u.id = b.user_id
      WHERE b.accepts_proposals = TRUE
        AND u.status = 'approved'`
  );
  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();
  const cities = [...new Set(rows.map(r => r.city).filter(Boolean))].sort();
  return { categories, cities };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

async function create(influencerId, brandId, payload) {
  const expires = new Date(Date.now() + PROPOSAL_TTL_DAYS * 86400 * 1000);

  const { rows } = await db.query(
    `INSERT INTO influencer_proposals
       (influencer_id, brand_id, pitch_title, pitch_message, goal,
        proposed_fee, proposed_commission_pct, proposed_deliverables,
        proposed_posting_window_start, proposed_posting_window_end,
        portfolio_links, expires_at,
        scope_level, scope_ref_json, theme_key, proposed_product_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16::jsonb)
     RETURNING *`,
    [
      influencerId, brandId,
      payload.pitch_title.trim(),
      payload.pitch_message.trim(),
      payload.goal || null,
      payload.proposed_fee != null ? Number(payload.proposed_fee) : null,
      payload.proposed_commission_pct != null ? Number(payload.proposed_commission_pct) : null,
      payload.proposed_deliverables ? JSON.stringify(payload.proposed_deliverables) : null,
      payload.proposed_posting_window_start || null,
      payload.proposed_posting_window_end || null,
      Array.isArray(payload.portfolio_links) ? payload.portfolio_links.slice(0, 3) : [],
      expires,
      // Phase 8 — scope + theme (all optional; NULL = unscoped, today's behavior)
      ['store', 'category', 'product'].includes(payload.scope_level) ? payload.scope_level : null,
      payload.scope_ref_json ? JSON.stringify(payload.scope_ref_json) : null,
      payload.theme_key || null,
      Array.isArray(payload.proposed_product_ids) ? JSON.stringify(payload.proposed_product_ids) : null,
    ]
  );
  return rows[0];
}

async function markViewed(proposalId) {
  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
         viewed_at = COALESCE(viewed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [proposalId]
  );
  return rows[0];
}

async function reject(proposalId, message) {
  const proposal = await getById(proposalId);
  if (!proposal) throw new Error('NOT_FOUND');
  if (!['sent', 'viewed', 'countered'].includes(proposal.status)) {
    throw new Error(`Cannot reject in status "${proposal.status}"`);
  }

  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = 'rejected',
         brand_response_at = NOW(),
         brand_response_message = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [proposalId, message || null]
  );

  // Cooldown — same brand can't see new pitches from this influencer for 30d.
  const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS_AFTER_REJECT * 86400 * 1000);
  await db.query(
    `INSERT INTO proposal_cooldowns (influencer_id, brand_id, cooldown_until, reason)
     VALUES ($1, $2, $3, 'brand_rejected')
     ON CONFLICT (influencer_id, brand_id)
       DO UPDATE SET cooldown_until = EXCLUDED.cooldown_until, reason = EXCLUDED.reason`,
    [proposal.influencer_id, proposal.brand_id, cooldownUntil]
  );
  return rows[0];
}

/**
 * Brand counters a pitch.
 *
 * collab-phase0: two changes.
 *   1. BOUNDED. This was unbounded — a brand could counter forever and grind a
 *      creator down. Now capped at handshake_settings.counter_rounds_per_side, the
 *      same admin-set number the brand→creator direction has always used.
 *   2. It can now answer the CREATOR's counter, not only a fresh pitch — otherwise
 *      giving her a counter-back creates a conversation neither side can close.
 */
async function counter(proposalId, counterTerms, message) {
  const proposal = await getById(proposalId);
  if (!proposal) throw new Error('NOT_FOUND');

  const answeringHerCounter = proposal.status === 'countered' && proposal.counter_by === 'creator';
  if (!['sent', 'viewed'].includes(proposal.status) && !answeringHerCounter) {
    if (proposal.status === 'countered' && proposal.counter_by === 'brand') {
      throw new Error('You already countered. It is the creator\'s turn.');
    }
    throw new Error(`Cannot counter in status "${proposal.status}".`);
  }

  const cfg = await settings.get();
  const used = Number(proposal.brand_rounds_used || 0);
  if (used >= cfg.counter_rounds_per_side) {
    throw new Error(`You have used both of your ${cfg.counter_rounds_per_side} counters — settle or decline.`);
  }

  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = 'countered',
         counter_by = 'brand',
         brand_rounds_used = brand_rounds_used + 1,
         brand_response_at = NOW(),
         brand_response_message = $2,
         counter_terms = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [proposalId, message || null, counterTerms ? JSON.stringify(counterTerms) : null]
  );
  return rows[0];
}

/**
 * Creator counters back on her own pitch.
 *
 * collab-phase0: NEW. Until now her only replies to a brand's counter were accept or
 * decline — pitch ₹20,000, get countered ₹8,000, and she could take ₹8,000 or walk.
 * The brand→creator direction has always had two counters each; this makes the pitch
 * direction symmetric under the same admin-set limit.
 *
 * Deliberately mirrors counter() above rather than sharing a body: the guards differ
 * (she may only answer THEIR counter) and merging them would need a side flag that
 * makes both harder to read.
 */
async function creatorCounter(proposalId, counterTerms) {
  const proposal = await getById(proposalId);
  if (!proposal) throw new Error('NOT_FOUND');

  if (proposal.status !== 'countered') {
    throw new Error(`Nothing to counter — this pitch is "${proposal.status}".`);
  }
  if (proposal.counter_by !== 'brand') {
    throw new Error('You already countered. It is the brand\'s turn.');
  }

  const cfg = await settings.get();
  const used = Number(proposal.creator_rounds_used || 0);
  if (used >= cfg.counter_rounds_per_side) {
    throw new Error(`You have used both of your ${cfg.counter_rounds_per_side} counters — accept or decline.`);
  }

  // Validated by the SAME module the brand→creator direction uses, against the terms
  // CURRENTLY on the table rather than the opening pitch — so round two answers round
  // one instead of re-litigating the original. A term either side marked as required
  // is refused here, server-side, not merely hidden on a screen.
  const current = currentTermsOf(proposal);
  const check = terms.validateCounter(current, counterTerms);
  if (!check.ok) { const e = new Error(check.message); e.field = check.field; throw e; }

  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = 'countered',
         counter_by = 'creator',
         creator_rounds_used = creator_rounds_used + 1,
         counter_terms = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [proposalId, counterTerms ? JSON.stringify(counterTerms) : null]
  );
  return rows[0];
}

async function withdraw(proposalId, influencerId) {
  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = 'withdrawn', updated_at = NOW()
     WHERE id = $1 AND influencer_id = $2 AND status IN ('sent','viewed','countered')
     RETURNING *`,
    [proposalId, influencerId]
  );
  return rows[0] || null;
}

async function flag(proposalId, reason) {
  await db.query(
    `UPDATE influencer_proposals
     SET flagged = TRUE, flag_reason = COALESCE($2, flag_reason)
     WHERE id = $1`,
    [proposalId, reason || null]
  );
}

// Phase 8 — a creator browses a brand's products to scope a proposal. Gated:
// only brands that opted into proposals are browsable (mirrors discover-brands).
async function browseBrandProducts(brandId, { search, limit = 40 } = {}) {
  const brand = (await db.query(`SELECT accepts_proposals FROM brands WHERE id = $1`, [brandId])).rows[0];
  if (!brand) { const e = new Error('Brand not found'); e.code = 'NOT_FOUND'; throw e; }
  if (!brand.accepts_proposals) { const e = new Error('This brand is not accepting proposals right now.'); e.code = 'FORBIDDEN'; throw e; }
  const params = [brandId];
  let where = 'brand_id = $1';
  if (search && String(search).trim()) { params.push(`%${String(search).trim()}%`); where += ` AND name ILIKE $${params.length}`; }
  params.push(Math.min(Number(limit) || 40, 100));
  const { rows } = await db.query(
    // collab-phase1 — send the product's OWN kind, not just the shop's trade. Every product
    // already carries it; this screen was simply never given it, which is why it could only
    // ever render one flat list.
    `SELECT id, name, price, image_url, category_key, super_category, category_node_id
       FROM brand_products WHERE ${where}
      ORDER BY created_at DESC NULLS LAST LIMIT $${params.length}`, params);
  return rows;
}

module.exports = {
  PROPOSAL_TTL_DAYS,
  COOLDOWN_DAYS_AFTER_REJECT,
  RATE_LIMITS,
  browseBrandProducts,
  checkEligibility,
  tierFromFollowers,
  getById,
  listForBrand,
  listForInfluencer,
  discoverEligibleBrands,
  discoveryFacets,
  create,
  markViewed,
  reject,
  counter,
  creatorCounter,
  currentTermsOf,
  withdraw,
  flag,
};
