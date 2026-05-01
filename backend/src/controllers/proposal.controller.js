'use strict';

/**
 * proposal.controller.js — Phase Q HTTP layer.
 *
 * Endpoints split across three audiences:
 *   - Influencer:   discover brands, send proposals, manage own list
 *   - Brand:        manage settings, inbox, accept/reject/counter
 *   - Admin:        moderation queue + suspension
 *
 * Acceptance fans out to existing campaign machinery: creates a mini-campaign
 * with one set + one campaign_influencer + auto-creates the contract draft.
 * From there the brand reviews and approves the contract via the standard
 * /v1/contracts/:id/approve endpoint.
 */

const db = require('../config/db');
const proposalService = require('../services/proposal.service');
const notificationService = require('../services/notification.service');
const contractService = require('../services/contract.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getInfluencerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT inf.*, u.id AS user_id, u.fcm_token, u.phone
     FROM influencers inf JOIN users u ON u.id = inf.user_id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}
async function getBrandByUserId(userId) {
  const { rows } = await db.query(
    `SELECT b.*, u.id AS user_id, u.fcm_token, u.phone
     FROM brands b JOIN users u ON u.id = b.user_id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function notify(targetUserId, fcmToken, phone, type, title, body, data, sms = false) {
  notificationService.send({
    userId: targetUserId, type, title, body, data,
    fcmToken, sendSms: sms, phone,
  }).catch(err => console.error('[PROPOSAL] notify failed:', err.message));
}

// ─── Influencer endpoints ───────────────────────────────────────────────────

// GET /v1/influencers/me/discover-brands
const discoverBrands = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const search = req.query.search || null;
  const brands = await proposalService.discoverEligibleBrands(inf.id, { search });
  return success(res, { brands });
});

// GET /v1/brands/:id/proposal-criteria — public-ish: returns filter snapshot
const getProposalCriteria = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.id, b.business_name, b.logo_url, b.category, b.accepts_proposals,
            b.proposal_filters, u.city
     FROM   brands b JOIN users u ON u.id = b.user_id
     WHERE  b.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  return success(res, { brand: rows[0] });
});

// POST /v1/influencers/me/proposals
const createProposal = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);

  const {
    brand_id, pitch_title, pitch_message, goal,
    proposed_fee, proposed_commission_pct, proposed_deliverables,
    proposed_posting_window_start, proposed_posting_window_end,
    portfolio_links,
  } = req.body || {};

  if (!brand_id) throw new AppError('VALIDATION_ERROR', 'brand_id is required', 422, 'brand_id');
  if (!pitch_title || !String(pitch_title).trim()) {
    throw new AppError('VALIDATION_ERROR', 'pitch_title is required', 422, 'pitch_title');
  }
  if (!pitch_message || !String(pitch_message).trim()) {
    throw new AppError('VALIDATION_ERROR', 'pitch_message is required', 422, 'pitch_message');
  }

  const elig = await proposalService.checkEligibility(inf.id, brand_id);
  if (!elig.eligible) {
    throw new AppError('FORBIDDEN', elig.reason, 403);
  }

  const proposal = await proposalService.create(inf.id, brand_id, {
    pitch_title, pitch_message, goal,
    proposed_fee, proposed_commission_pct, proposed_deliverables,
    proposed_posting_window_start, proposed_posting_window_end,
    portfolio_links,
  });

  // Notify brand
  const { rows: brandRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone, b.business_name
     FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [brand_id]
  );
  const brand = brandRows[0];
  if (brand) {
    notify(
      brand.user_id, brand.fcm_token, brand.phone,
      'proposal.received',
      'New proposal',
      `${inf.instagram_handle ? '@' + inf.instagram_handle : 'An influencer'} sent you a proposal.`,
      { screen: 'brand_proposal_inbox', proposal_id: proposal.id }
    );
  }

  return success(res, { proposal }, 201);
});

// GET /v1/influencers/me/proposals
const listMyProposals = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const list = await proposalService.listForInfluencer(inf.id, { status: req.query.status || null });
  return success(res, { proposals: list });
});

// GET /v1/influencers/me/proposals/:id
const getMyProposal = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.influencer_id !== inf.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  return success(res, { proposal });
});

// POST /v1/influencers/me/proposals/:id/withdraw
const withdrawMyProposal = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const updated = await proposalService.withdraw(req.params.id, inf.id);
  if (!updated) throw new AppError('VALIDATION_ERROR', 'Proposal cannot be withdrawn', 422);
  return success(res, { proposal: updated });
});

// POST /v1/influencers/me/proposals/:id/respond-counter
// Influencer accepts or declines the brand's counter.
const respondToCounter = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.influencer_id !== inf.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  if (proposal.status !== 'countered') {
    throw new AppError('VALIDATION_ERROR', `Cannot respond to counter in status "${proposal.status}"`, 422);
  }
  const action = String(req.body?.action || '').toLowerCase();  // 'accept' | 'decline'
  if (!['accept', 'decline'].includes(action)) {
    throw new AppError('VALIDATION_ERROR', 'action must be "accept" or "decline"', 422, 'action');
  }

  if (action === 'decline') {
    await db.query(
      `UPDATE influencer_proposals
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1`,
      [proposal.id]
    );
    return success(res, { proposal: { ...proposal, status: 'rejected' } });
  }

  // Accept counter — same flow as brand-accept (acceptedFlow uses counter terms)
  const ci = await acceptedFlow(proposal, /* useCounterTerms */ true);
  return success(res, { proposal: { ...proposal, status: 'accepted', resulting_campaign_influencer_id: ci.id } });
});

// ─── Brand endpoints ────────────────────────────────────────────────────────

// GET /v1/brands/me/proposal-settings
const getBrandSettings = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  return success(res, {
    accepts_proposals: !!brand.accepts_proposals,
    proposal_filters:  brand.proposal_filters || {},
  });
});

// PATCH /v1/brands/me/proposal-settings
const updateBrandSettings = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  const { accepts_proposals, proposal_filters } = req.body || {};
  const fields = [];
  const params = [];
  if (typeof accepts_proposals === 'boolean') {
    params.push(accepts_proposals);
    fields.push(`accepts_proposals = $${params.length}`);
  }
  if (proposal_filters && typeof proposal_filters === 'object') {
    params.push(JSON.stringify(proposal_filters));
    fields.push(`proposal_filters = $${params.length}`);
  }
  if (!fields.length) throw new AppError('VALIDATION_ERROR', 'No fields to update', 422);
  params.push(brand.id);
  const { rows } = await db.query(
    `UPDATE brands SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING accepts_proposals, proposal_filters`,
    params
  );
  return success(res, rows[0]);
});

// GET /v1/brands/me/proposals
const listBrandProposals = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const list = await proposalService.listForBrand(brand.id, { status: req.query.status || null });
  return success(res, { proposals: list });
});

// GET /v1/brands/me/proposals/:id
const getBrandProposal = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.brand_id !== brand.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  if (proposal.status === 'sent') {
    await proposalService.markViewed(proposal.id);
    proposal.status = 'viewed';
    proposal.viewed_at = new Date().toISOString();
  }
  return success(res, { proposal });
});

// POST /v1/brands/me/proposals/:id/accept
const acceptProposal = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.brand_id !== brand.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  if (!['sent', 'viewed'].includes(proposal.status)) {
    throw new AppError('VALIDATION_ERROR', `Cannot accept in status "${proposal.status}"`, 422);
  }

  const ci = await acceptedFlow(proposal, /* useCounterTerms */ false);

  // Notify influencer
  const { rows: infRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone, u.name
     FROM influencers inf JOIN users u ON u.id = inf.user_id WHERE inf.id = $1`,
    [proposal.influencer_id]
  );
  const inf = infRows[0];
  if (inf) {
    notify(
      inf.user_id, inf.fcm_token, inf.phone,
      'proposal.accepted',
      'Proposal accepted',
      `${brand.business_name} accepted your pitch. The contract is being prepared.`,
      { screen: 'campaign_detail', campaign_influencer_id: ci.id },
      true
    );
  }

  const updated = await proposalService.getById(proposal.id);
  return success(res, { proposal: updated });
});

// POST /v1/brands/me/proposals/:id/reject  Body: { message? }
const rejectProposal = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.brand_id !== brand.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  let updated;
  try {
    updated = await proposalService.reject(proposal.id, req.body?.message || null);
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const { rows: infRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone
     FROM influencers inf JOIN users u ON u.id = inf.user_id WHERE inf.id = $1`,
    [proposal.influencer_id]
  );
  const inf = infRows[0];
  if (inf) {
    notify(
      inf.user_id, inf.fcm_token, inf.phone,
      'proposal.rejected',
      'Proposal declined',
      `${brand.business_name} declined your pitch${req.body?.message ? `: ${req.body.message}` : '.'}`,
      { screen: 'my_proposals' }
    );
  }
  return success(res, { proposal: updated });
});

// POST /v1/brands/me/proposals/:id/counter  Body: { counter_terms, message? }
const counterProposal = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.brand_id !== brand.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  if (!req.body?.counter_terms) {
    throw new AppError('VALIDATION_ERROR', 'counter_terms is required', 422, 'counter_terms');
  }
  let updated;
  try {
    updated = await proposalService.counter(proposal.id, req.body.counter_terms, req.body.message || null);
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', err.message, 422);
  }

  const { rows: infRows } = await db.query(
    `SELECT u.id AS user_id, u.fcm_token, u.phone
     FROM influencers inf JOIN users u ON u.id = inf.user_id WHERE inf.id = $1`,
    [proposal.influencer_id]
  );
  const inf = infRows[0];
  if (inf) {
    notify(
      inf.user_id, inf.fcm_token, inf.phone,
      'proposal.countered',
      'Brand sent a counter',
      `${brand.business_name} suggested updated terms. Review and accept or decline.`,
      { screen: 'my_proposals', proposal_id: proposal.id }
    );
  }
  return success(res, { proposal: updated });
});

// POST /v1/brands/me/proposals/:id/flag
const flagProposal = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const proposal = await proposalService.getById(req.params.id);
  if (!proposal || proposal.brand_id !== brand.id) {
    throw new AppError('NOT_FOUND', 'Proposal not found', 404);
  }
  await proposalService.flag(proposal.id, req.body?.reason || null);
  return success(res, { ok: true });
});

// ─── Acceptance flow (shared) ───────────────────────────────────────────────
//
// When a proposal is accepted (either by brand on initial offer, or by
// influencer on a counter), spin up the campaign chain: campaign + set +
// campaign_influencer + contract draft. Brand still has to approve the
// contract via the standard flow before money locks.
async function acceptedFlow(proposal, useCounterTerms) {
  const terms = useCounterTerms && proposal.counter_terms
    ? (typeof proposal.counter_terms === 'string' ? JSON.parse(proposal.counter_terms) : proposal.counter_terms)
    : {
        proposed_fee:                  proposal.proposed_fee,
        proposed_commission_pct:       proposal.proposed_commission_pct,
        proposed_deliverables:         proposal.proposed_deliverables,
        proposed_posting_window_start: proposal.proposed_posting_window_start,
        proposed_posting_window_end:   proposal.proposed_posting_window_end,
        goal:                          proposal.goal,
      };

  const goal = (terms.goal || proposal.goal || 'engagement').toLowerCase();
  const fee  = Number(terms.proposed_fee || proposal.proposed_fee || 0);
  const commissionPct = Number(terms.proposed_commission_pct || proposal.proposed_commission_pct || 0);
  const deliverables = terms.proposed_deliverables || proposal.proposed_deliverables || [{ type: 'reel', count: 1 }];

  // 1. Create a mini campaign owned by the brand
  const { rows: campRows } = await db.query(
    `INSERT INTO campaigns (brand_id, name, status, created_at)
     VALUES ($1, $2, 'draft', NOW())
     RETURNING *`,
    [proposal.brand_id, `Proposal: ${proposal.pitch_title}`]
  );
  const campaign = campRows[0];

  // 2. Create the set
  const formatsJson = (Array.isArray(deliverables) ? deliverables : []).map(d => ({
    name:  d.type === 'reel'  ? 'Instagram reel'
         : d.type === 'post'  ? 'Instagram post'
         : d.type === 'story' ? 'Instagram stories'
         : d.type === 'youtube_video' ? 'YouTube video'
         : d.type === 'youtube_short' ? 'YouTube short'
         : 'Instagram reel',
    count: Math.max(1, Number(d.count || 1)),
  }));
  const { rows: setRows } = await db.query(
    `INSERT INTO campaign_sets
       (campaign_id, name, goal, formats_json, influencer_mode, set_budget)
     VALUES ($1, 'Set A', $2, $3, 'handpick', $4)
     RETURNING *`,
    [
      campaign.id, goal,
      JSON.stringify(formatsJson),
      goal === 'conversion' ? null : fee,
    ]
  );
  const set = setRows[0];

  // 3. Create the campaign_influencer assignment (status=accepted so contract auto-create logic fires)
  const { rows: ciRows } = await db.query(
    `INSERT INTO campaign_influencers
       (set_id, campaign_id, influencer_id, status,
        influencer_budget, commission_pct, posting_date)
     VALUES ($1, $2, $3, 'accepted', $4, $5, $6)
     RETURNING *`,
    [
      set.id, campaign.id, proposal.influencer_id,
      goal === 'conversion' ? 0 : fee,
      commissionPct || null,
      terms.proposed_posting_window_start || null,
    ]
  );
  const ci = ciRows[0];

  // 4. Trigger contract auto-create (existing flow). This creates a
  //    contract row in 'draft' status. Brand approves via /contracts/:id/approve.
  try {
    await contractService.autoCreate(ci.id);
  } catch (err) {
    console.error('[PROPOSAL] contract auto-create failed:', err.message);
    // non-fatal — brand can retry from contract screen
  }

  // 5. Update proposal with the link
  await db.query(
    `UPDATE influencer_proposals
     SET status = 'accepted',
         brand_response_at = NOW(),
         resulting_campaign_influencer_id = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [proposal.id, ci.id]
  );

  return ci;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

// GET /v1/admin/proposals
const adminListProposals = asyncHandler(async (req, res) => {
  const flaggedOnly = req.query.flagged === 'true';
  const params = [];
  let where = 'WHERE 1=1';
  if (flaggedOnly) where += ' AND p.flagged = TRUE';

  const { rows } = await db.query(
    `SELECT p.id, p.influencer_id, p.brand_id, p.status, p.flagged, p.flag_reason, p.created_at,
            p.pitch_title,
            inf_u.name AS influencer_name, inf.instagram_handle,
            b.business_name AS brand_name
     FROM   influencer_proposals p
     JOIN   influencers inf ON inf.id = p.influencer_id
     JOIN   users inf_u ON inf_u.id = inf.user_id
     JOIN   brands b ON b.id = p.brand_id
     ${where}
     ORDER  BY p.created_at DESC LIMIT 200`,
    params
  );
  return success(res, { proposals: rows });
});

// POST /v1/admin/influencers/:id/proposal-status  Body: { status, banned_until? }
const adminSetInfluencerStatus = asyncHandler(async (req, res) => {
  const { status, banned_until } = req.body || {};
  if (!['eligible', 'suspended', 'banned'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be eligible | suspended | banned', 422, 'status');
  }
  const { rows } = await db.query(
    `UPDATE influencers
     SET proposal_status = $2,
         proposal_banned_until = $3
     WHERE id = $1
     RETURNING id, proposal_status, proposal_banned_until`,
    [req.params.id, status, banned_until || null]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  return success(res, { influencer: rows[0] });
});

module.exports = {
  // Influencer
  discoverBrands,
  getProposalCriteria,
  createProposal,
  listMyProposals,
  getMyProposal,
  withdrawMyProposal,
  respondToCounter,
  // Brand
  getBrandSettings,
  updateBrandSettings,
  listBrandProposals,
  getBrandProposal,
  acceptProposal,
  rejectProposal,
  counterProposal,
  flagProposal,
  // Admin
  adminListProposals,
  adminSetInfluencerStatus,
};
