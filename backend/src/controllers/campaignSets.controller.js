'use strict';

/**
 * Item 4 — the three read endpoints the Brand app's Campaigns tab is built on (A1, A5, A10).
 * Contract: features/item4-campaigns-sets · prompt §5
 *
 * These are NEW endpoints, so another brand's campaign answers 404 (prompt §5 privacy;
 * APPROVAL.md Q7 keeps the older endpoints at 403). Nothing here writes.
 */
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const state = require('../services/campaignState.service');

async function brandIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  return rows[0].id;
}

/** 404 for missing AND for another brand's campaign — the new endpoints never confirm existence. */
async function ownedCampaign(campaignId, brandId) {
  const { rows } = await db.query(
    `SELECT c.*, g.name AS group_name
       FROM campaigns c LEFT JOIN influencer_groups g ON g.id = c.started_from_group_id
      WHERE c.id = $1 AND c.brand_id = $2`,
    [campaignId, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  return rows[0];
}

const SET_SELECT = `
  SELECT s.*, b.name AS branch_name, rc.name AS branch_city
    FROM campaign_sets s
    LEFT JOIN brand_branches b ON b.id = s.branch_id
    LEFT JOIN ref_cities rc ON rc.id = b.city_id`;

function shapeCampaign(c) {
  return {
    id: c.id, name: c.name, brief: c.brief || null,
    createdAt: c.created_at, updatedAt: c.updated_at || c.created_at,
    startedFromGroup: c.started_from_group_id ? { id: c.started_from_group_id, name: c.group_name || null } : null,
    // Item 6 (N18): the negotiation switch, on by default.
    allowNegotiation: c.allow_negotiation !== false,
    legacyStatus: c.status,
  };
}

function shapeSet(s, counts, today) {
  const d = state.describeSet(s, counts, today);
  return {
    id: s.id, campaignId: s.campaign_id, name: s.name,
    state: d.state, datePassed: d.datePassed, locked: d.locked, lockedFields: d.lockedFields,
    goal: s.goal || null, shootMode: s.shoot_mode || null,
    branch: s.branch_id ? { id: s.branch_id, name: s.branch_name || null, cityName: s.branch_city || null } : null,
    postingDate: d.postingDate, cutoff: d.cutoff, daysToCutoff: d.daysToCutoff, cutoffPassed: d.cutoffPassed,
    expiredAt: s.expired_at || null,
    counts: { invited: counts.invited, signed: counts.signed, waiting: counts.waiting, declined: counts.declined },
    canInvite: d.canInvite,
    createdAt: s.created_at || null, updatedAt: s.updated_at || null,
    isPast: d.isPast,
  };
}

/** Sets of many campaigns with their counts, in one query each. */
async function setsFor(campaignIds) {
  if (!campaignIds.length) return { byCampaign: new Map(), counts: new Map() };
  const { rows } = await db.query(`${SET_SELECT} WHERE s.campaign_id = ANY($1::uuid[]) ORDER BY s.created_at DESC NULLS LAST, s.id`, [campaignIds]);
  const counts = await state.countsForSets(rows.map(r => r.id));
  const byCampaign = new Map();
  for (const r of rows) {
    if (!byCampaign.has(r.campaign_id)) byCampaign.set(r.campaign_id, []);
    byCampaign.get(r.campaign_id).push(r);
  }
  return { byCampaign, counts };
}

/**
 * GET /campaigns/summary?state=live|draft|past&page=1&limit=20   (A1, C1)
 * State is derived from the sets, so the filter is applied after derivation. A brand has a
 * handful of campaigns, so all of them are read once and paged in memory; the per-set counts
 * are still one grouped query.
 */
const listSummary = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const filter = String(req.query.state || '').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const { rows: camps } = await db.query(
    `SELECT c.*, g.name AS group_name FROM campaigns c LEFT JOIN influencer_groups g ON g.id = c.started_from_group_id
      WHERE c.brand_id = $1 ORDER BY COALESCE(c.updated_at, c.created_at) DESC`, [brandId]);
  const { byCampaign, counts } = await setsFor(camps.map(c => c.id));

  const all = camps.map(c => {
    const sets = (byCampaign.get(c.id) || []).map(s => shapeSet(s, counts.get(s.id) || state.EMPTY_COUNTS, null));
    const st = state.campaignStateFrom(sets);
    const live = sets.filter(s => !s.isPast);
    const next = live.map(s => s.postingDate).filter(Boolean).sort()[0] || null;
    const total = state.sumCounts(sets.map(s => counts.get(s.id) || state.EMPTY_COUNTS));
    return {
      ...shapeCampaign(c), state: st, setCount: sets.length, nextPostingDate: next,
      counts: { invited: total.invited, signed: total.signed, waiting: total.waiting, declined: total.declined },
    };
  });
  const bucket = (s) => (s === 'live' ? 'live' : s === 'draft' ? 'draft' : 'past');
  const filtered = ['live', 'draft', 'past'].includes(filter) ? all.filter(c => bucket(c.state) === filter) : all;
  const start = (page - 1) * limit;
  return success(res, {
    campaigns: filtered.slice(start, start + limit),
    page, limit, total: filtered.length,
    tabs: { live: all.filter(c => bucket(c.state) === 'live').length, draft: all.filter(c => bucket(c.state) === 'draft').length, past: all.filter(c => bucket(c.state) === 'past').length },
  });
});

/** GET /campaigns/:id/summary   (A5, C6) */
const campaignSummary = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const c = await ownedCampaign(req.params.id, brandId);
  const { byCampaign, counts } = await setsFor([c.id]);
  const sets = (byCampaign.get(c.id) || []).map(s => shapeSet(s, counts.get(s.id) || state.EMPTY_COUNTS, null));
  const total = state.sumCounts(sets.map(s => counts.get(s.id) || state.EMPTY_COUNTS));
  return success(res, {
    campaign: {
      ...shapeCampaign(c), state: state.campaignStateFrom(sets), setCount: sets.length,
      counts: { invited: total.invited, signed: total.signed, waiting: total.waiting, declined: total.declined },
      canDelete: !(await state.campaignHasAnyInvitation(c.id)),
    },
    sets: { current: sets.filter(s => !s.isPast), past: sets.filter(s => s.isPast) },
    dateRules: state.dateRules(),
  });
});

/** GET /campaigns/:id/sets/:sid/summary   (A10, C7–C9) */
const setSummary = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const c = await ownedCampaign(req.params.id, brandId);
  const { rows } = await db.query(`${SET_SELECT} WHERE s.id = $1 AND s.campaign_id = $2`, [req.params.sid, c.id]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Set not found', 404);
  const counts = (await state.countsForSets([rows[0].id])).get(rows[0].id) || state.EMPTY_COUNTS;
  const set = shapeSet(rows[0], counts, null);
  // Item 5 (A9) — the set's creators grouped in the I9 order, at most 50 per group with the
  // real count (APPROVAL.md §3.5). Contract: features/item5-invitations
  const invitationRows = require('../services/invitationRows.service');
  const creators = await invitationRows.creatorsForSet(rows[0].id, rows[0].goal);
  return success(res, {
    set: { ...set, canDelete: !set.locked },
    campaign: { id: c.id, name: c.name },
    creators,
    dateRules: state.dateRules(),
  });
});

module.exports = { listSummary, campaignSummary, setSummary, shapeSet, SET_SELECT };
