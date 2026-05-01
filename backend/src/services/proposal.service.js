'use strict';

/**
 * proposal.service.js — Phase Q (Influencer Proposals)
 *
 * Eligibility checks, rate limits, state transitions for influencer-
 * initiated proposals to brands.
 */

const db = require('../config/db');

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
async function discoverEligibleBrands(influencerId, { search, limit = 30 } = {}) {
  const params = [influencerId];
  let q = `SELECT b.id, b.business_name, b.logo_url, b.category, b.proposal_filters,
                  u.city AS brand_city
           FROM   brands b
           JOIN   users u ON u.id = b.user_id
           WHERE  b.accepts_proposals = TRUE
             AND  u.status = 'approved'`;
  if (search) {
    params.push(`%${search}%`);
    q += ` AND b.business_name ILIKE $${params.length}`;
  }
  params.push(Math.min(limit, 100));
  q += ` ORDER BY b.created_at DESC LIMIT $${params.length}`;

  const { rows } = await db.query(q, params);
  // Return all listed brands; eligibility is checked per-brand on submit.
  return rows;
}

// ─── Mutations ──────────────────────────────────────────────────────────────

async function create(influencerId, brandId, payload) {
  const expires = new Date(Date.now() + PROPOSAL_TTL_DAYS * 86400 * 1000);

  const { rows } = await db.query(
    `INSERT INTO influencer_proposals
       (influencer_id, brand_id, pitch_title, pitch_message, goal,
        proposed_fee, proposed_commission_pct, proposed_deliverables,
        proposed_posting_window_start, proposed_posting_window_end,
        portfolio_links, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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

async function counter(proposalId, counterTerms, message) {
  const proposal = await getById(proposalId);
  if (!proposal) throw new Error('NOT_FOUND');
  if (!['sent', 'viewed'].includes(proposal.status)) {
    throw new Error(`Cannot counter in status "${proposal.status}". Only one counter round is allowed.`);
  }

  const { rows } = await db.query(
    `UPDATE influencer_proposals
     SET status = 'countered',
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

module.exports = {
  PROPOSAL_TTL_DAYS,
  COOLDOWN_DAYS_AFTER_REJECT,
  RATE_LIMITS,
  checkEligibility,
  tierFromFollowers,
  getById,
  listForBrand,
  listForInfluencer,
  discoverEligibleBrands,
  create,
  markViewed,
  reject,
  counter,
  withdraw,
  flag,
};
