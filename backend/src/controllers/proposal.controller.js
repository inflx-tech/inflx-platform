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
// collab-part2 — acceptance produces an agreement, not a campaign. The
// contract.service import that used to live here is gone with it: a contract is now
// created from the real campaign the brand builds, not drafted against a fabricated one.
const handshake = require('../services/handshake.service');
// collab-phase0 — the diary, and the admin-set round limits shared with the handshake.
const events = require('../services/collabEvents.service');
const settings = require('../services/handshakeSettings.service');
// Item 2 — the brand's pitch settings (rules v1.10 §8A). Contract: features/item2-pitch-invitation-settings
const eligibility = require('../services/collabEligibility.service');
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
  // collab-part6 §6.2
  const category = req.query.category || null;
  const city = req.query.city || null;
  const [brands, facets] = await Promise.all([
    proposalService.discoverEligibleBrands(inf.id, { search, category, city }),
    proposalService.discoveryFacets(),
  ]);
  // Facets ride along with the list so the filter controls are populated from real data
  // in the same round trip — an option that returns nothing is never offered.
  return success(res, { brands, facets });
});

// GET /v1/influencers/me/discover-brands/:id/products — Phase 8: browse a
// brand's catalog to scope a proposal (gated: brand accepts proposals).
const discoverBrandProducts = asyncHandler(async (req, res) => {
  const inf = await getInfluencerByUserId(req.user.sub);
  if (!inf) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  let products;
  try { products = await proposalService.browseBrandProducts(req.params.id, { search: req.query.q }); }
  catch (e) {
    if (e.code === 'FORBIDDEN') throw new AppError('FORBIDDEN', e.message, 403);
    if (e.code === 'NOT_FOUND') throw new AppError('NOT_FOUND', e.message, 404);
    throw e;
  }
  return success(res, { products });
});

// GET /v1/brands/:id/proposal-criteria — what a creator may know about a brand's pitch
// settings: paused or accepting, the Aims and modes it accepts, and a coarse reason. This
// used to return the raw proposal_filters — every threshold, to any signed-in user. Item 2
// (rules §8A "thresholds are private"): only the public summary leaves the server.
const getProposalCriteria = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.id, b.business_name, b.logo_url, b.category, b.sub_categories, u.city
     FROM   brands b JOIN users u ON u.id = b.user_id
     WHERE  b.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  const viewer = req.user.role === 'influencer' ? await getInfluencerByUserId(req.user.sub) : null;
  const pitchSummary = await eligibility.pitchSummaryFor(rows[0].id, viewer ? viewer.id : null);
  return success(res, { brand: rows[0], pitchSummary });
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

/**
 * Item 8 — the seven WRITE doors on this path are gone, not switched off.
 *
 * Sending, withdrawing, countering, answering a counter, accepting and
 * rejecting a pitch all now live in services/pitch.service, behind
 * routes/item8.routes. Keeping a second set would have kept a second set of
 * rules: none of these checked the mode, stamped a response deadline, honoured
 * item 4's date floor or went through item 6's thread, and accepting here wrote
 * a collab_agreements row — the destination item 8 retired (rules v1.21 §8).
 *
 * What stays are the READS, which nothing has replaced yet: brand discovery,
 * the criteria card, the two lists, the flag, and the admin queue.
 */
module.exports = {
  // Influencer
  discoverBrands,
  discoverBrandProducts,
  getProposalCriteria,
  listMyProposals,
  getMyProposal,
  // Brand
  getBrandSettings,
  updateBrandSettings,
  listBrandProposals,
  getBrandProposal,
  flagProposal,
  // Admin
  adminListProposals,
  adminSetInfluencerStatus,
};
