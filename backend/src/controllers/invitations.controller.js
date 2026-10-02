'use strict';

/**
 * Item 5 — choosing creators, terms and invitations: the HTTP layer.
 * Contract: features/item5-invitations · prompt §5 (A1–A4, A8–A16) · APPROVAL.md
 *
 * Brand (under /campaigns/:id/sets/:sid, another brand's campaign answers 404):
 *   GET  /pickable?tab=all|worked&…        A1, A2  the item 3 lists with a per-row pick state
 *   GET  /group-check/:groupId             A3      a whole group against this set
 *   POST /eligibility                      A4      per creator: can invite, warnings, minimums
 *   POST /invitations                      A8      one all-or-nothing send
 *   GET  /invitations/:ciId                A10     one invitation, terms as sent, timeline
 *   POST /invitations/:ciId/withdraw       A11
 *   POST /invitations/:ciId/remove         A12
 * Creator (another creator's row answers 404):
 *   GET  /influencers/me/invitations?tab=invites|done   A13
 *   GET  /influencers/me/invitations/:ciId              A14
 *   POST /influencers/me/invitations/:ciId/accept       A15
 *   POST /influencers/me/invitations/:ciId/decline      A16
 * Counter (A17) is hidden, not refused: the creator detail carries canCounter and the app shows
 * the button only when it is true; nothing here writes to the negotiation tables.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const discovery = require('../services/discovery.service');
const eligibility = require('../services/collabEligibility.service');
const invitationSend = require('../services/invitationSend.service');
const invitationAnswer = require('../services/invitationAnswer.service');
const rowsSvc = require('../services/invitationRows.service');
const campaignState = require('../services/campaignState.service');
const { SET_SELECT, shapeSet } = require('./campaignSets.controller');
const { resolveAvatars } = require('../utils/avatarResolver');
const { SIGNED_CONTRACT_SQL } = require('../services/collabState');
// creator-terms-v2 — the brand's choices for a set, and the creator's read-only views.
const creatorTerms = require('../services/creatorTerms.service');
// ui-walk-fixes (D2) — the one place a "can't invite" line and sentence are worded.
const { cantInvite } = require('../services/invitationCopy');

/* ────────────────────────────────────────────────────────── ownership */

async function brandOf(userId) {
  const { rows } = await db.query(`SELECT id, user_id, business_name FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  return rows[0];
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}
/** 404 for missing AND for another brand's campaign or set — never confirm existence. */
async function ownedCampaignAndSet(req, brandId) {
  const { rows: c } = await db.query(`SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2`, [req.params.id, brandId]);
  if (!c[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  const { rows: s } = await db.query(`${SET_SELECT} WHERE s.id = $1 AND s.campaign_id = $2`, [req.params.sid, c[0].id]);
  if (!s[0]) throw new AppError('NOT_FOUND', 'Set not found', 404);
  return { campaign: c[0], set: s[0] };
}

/* ───────────────────────────────────────────────── pick-state overlay */

// "Can't invite" is no longer worded here: since founder decision D2 (ui-walk-fixes, 2 Oct 2026)
// the short line and the sentence come from the item 2 service, which knows WHICH rule failed
// (invitationCopy.cantInvite). Only the label for a creator already in the set is this file's.
const PICK_LABEL = { IN_SET: 'Already in this set' };

/** Map<influencerId, 'live' | 'dead'> for this set. */
async function inSetMap(setId, ids) {
  if (!ids.length) return new Map();
  const { rows } = await db.query(
    `SELECT influencer_id, bool_or(status = ANY($3::campaign_influencer_status[])) AS live
       FROM campaign_influencers WHERE set_id = $1 AND influencer_id = ANY($2::uuid[]) GROUP BY influencer_id`,
    [setId, ids, invitationSend.LIVE_STATUSES]
  );
  return new Map(rows.map(r => [r.influencer_id, r.live ? 'live' : 'dead']));
}

/**
 * For each creator, one of:
 *   { state: 'ok',         label: null, reason: 'OK', inSet }
 *   { state: 'invited',    label: 'Already in this set', reason: null, inSet: 'live' }
 *   { state: 'ineligible', reason (coarse, unchanged), detail, label, message, inSet }
 *
 * ui-walk-fixes, founder decision D2 (2 Oct 2026): a creator who can't be invited now says
 * WHY — `label` is the short line for her row, `message` the sentence shown when the brand
 * taps her, `detail` which rule it was (aim | mode | category | visit_city | not_accepting,
 * or null when it is none of hers). This REVERSES item 5's "the real reason is never sent".
 * One reason only, the first that fails; paused and blocked read the same; her minimums are
 * never a reason. All of it is decided and worded in collabEligibility — nothing here.
 *
 * `names` (Map or object, influencerId → name) is what the caller's own rows already hold,
 * so the sentence costs no extra query on a page of creators.
 */
async function pickStates({ brandId, set, ids, names }) {
  const known = names instanceof Map ? names : new Map(Object.entries(names || {}));
  const [elig, inSet] = await Promise.all([
    eligibility.canBrandInviteMany({ brandId, set, creators: ids.map(id => ({ influencerId: id })), names: known }),
    inSetMap(set.id, ids),
  ]);
  const byId = new Map(elig.map(e => [e.influencerId, e]));
  const out = new Map();
  for (const id of ids) {
    // A creator the service returned nothing for is not one of her rules: the old line.
    const e = byId.get(id) || { ok: false, reason: 'NOT_MATCHING', ...cantInvite({ detail: null, name: known.get(id) }) };
    const live = inSet.get(id) === 'live';
    out.set(id, live
      ? { state: 'invited', label: PICK_LABEL.IN_SET, reason: null, inSet: 'live' }
      : e.ok
        ? { state: 'ok', label: null, reason: 'OK', inSet: inSet.get(id) || 'none' }
        : { state: 'ineligible', reason: e.reason, detail: e.detail || null, label: e.label, message: e.message, inSet: inSet.get(id) || 'none' });
  }
  return out;
}

/* ───────────────────────────────────────────────────────────── brand */

/** A1 / A2 — GET /campaigns/:id/sets/:sid/pickable?tab=all|worked */
const pickable = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  const tab = req.query.tab === 'worked' ? 'worked' : (req.query.tab === 'pool' ? 'pool' : 'all');
  let out;
  if (tab === 'all') {
    out = await discovery.discoverCreators(brand.id, { ...req.query, withGroups: false });
  } else if (tab === 'worked') {
    out = await workedWith(brand.id, req.query);
  } else {
    // Item 6 (B13): the pool as a picker source. Terms travel only when the Aim matches;
    // in a set of another Aim she is an ordinary pick with empty terms (rules §7B).
    const poolService = require('../services/pool.service');
    const list = await poolService.listForBrand(brand.id, { goal: set.goal });
    const rows = list.groups.flatMap(g => g.rows).map(e => ({
      id: e.creator.id, name: e.creator.name, avatarUrl: e.creator.avatarUrl, nicheLabel: null, cityName: null, instagram: null,
      pool: { entryId: e.entryId, goal: e.goal, terms: e.selectable ? e.terms : null, termsLine: e.termsLine, sameAim: e.selectable, wantsGoLiveDate: e.wantsGoLiveDate, wantsShootMode: e.wantsShootMode, daysLeft: e.daysLeft, closingSoon: e.closingSoon, noLongerPossible: e.noLongerPossible, agreedAt: e.agreedAt },
    }));
    out = { total: rows.length, page: 1, rows };
  }
  // The Filters pop-up's count ("Show 14 creators", ui-walk-fixes frame B4): with countOnly the
  // All creators list answers { total } and no rows. This used to map over the missing rows and
  // answer 500, which the phone printed as "Show 0 creators" for every choice. Only that call
  // arrives here without rows — Worked with and Pool always carry them.
  if (!out.rows) return success(res, { tab, total: out.total });
  const states = await pickStates({ brandId: brand.id, set, ids: out.rows.map(r => r.id), names: new Map(out.rows.map(r => [r.id, r.name])) });
  out.rows = out.rows.map(r => ({ ...r, pick: states.get(r.id) }));
  return success(res, { tab, ...out, set: { id: set.id, name: set.name, goal: set.goal, shootMode: set.shoot_mode, branchCity: set.branch_city || null } });
});

/** Worked with, the item 3 rule (contracts signed by both), shaped like a Discover row. */
async function workedWith(brandId, q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const params = [brandId];
  let searchSql = '';
  if (q.search && String(q.search).trim()) {
    params.push(`%${String(q.search).trim().replace(/^@+/, '').toLowerCase()}%`);
    searchSql = `AND (lower(COALESCE(i.full_name, u.name)) LIKE $2 OR lower(i.instagram_handle) LIKE $2)`;
  }
  // The joins and the filter are kept apart because the page query adds two more joins, and a
  // join cannot follow a WHERE. They were one string until 2 Oct 2026, which put the LEFT JOINs
  // after the WHERE: the page query was a syntax error and this tab answered 500 on every call
  // since item 5 shipped (no test asked for tab=worked; found while building ui-walk-fixes D2).
  const from = `
    FROM contracts con
    JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users u ON u.id = i.user_id`;
  const where = `WHERE c.brand_id = $1 AND ${SIGNED_CONTRACT_SQL} AND u.status = 'approved' ${searchSql}`;
  const { rows: cnt } = await db.query(`SELECT count(DISTINCT i.id)::int AS n ${from} ${where}`, params);
  params.push(discovery.PAGE, (page - 1) * discovery.PAGE);
  const { rows } = await db.query(
    `SELECT i.id, COALESCE(i.full_name, u.name) AS name, i.instagram_handle, i.profile_image_r2_key, i.followers_count,
            rc.name AS city_name, rn.label AS niche_label,
            count(*)::int AS collaborations, max(GREATEST(con.influencer_signed_at, con.brand_signed_at)) AS last_signed_at
       ${from}
       LEFT JOIN ref_cities rc ON rc.id = i.city_id
       LEFT JOIN ref_creator_niches rn ON rn.code = i.niche[1]
       ${where}
      GROUP BY i.id, u.name, rc.name, rn.label
      ORDER BY last_signed_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  return {
    total: cnt[0].n, page,
    rows: rows.map(r => ({ id: r.id, name: r.name, instagramHandle: r.instagram_handle, avatarUrl: r.avatar_url || null, nicheLabel: r.niche_label || null, cityName: r.city_name || null, instagram: r.followers_count == null ? null : Number(r.followers_count), collaborations: r.collaborations, lastSignedAt: r.last_signed_at })),
  };
}

/** A3 — GET /campaigns/:id/sets/:sid/group-check/:groupId */
const groupCheck = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  const { rows: g } = await db.query(`SELECT id, name FROM influencer_groups WHERE id = $1 AND brand_id = $2`, [req.params.groupId, brand.id]);
  if (!g[0]) throw new AppError('NOT_FOUND', 'Group not found', 404);
  const subs = await discovery.brandSubCategories(brand.id);
  const { rows } = await db.query(
    `WITH ${discovery.CREATOR_BASE_CTE}
     SELECT sc.id, sc.name, sc.instagram_handle, sc.youtube_handle, sc.niche_code, sc.languages, sc.followers_count,
            sc.youtube_subscribers, sc.engagement_rate, sc.measured_at, sc.city_id, sc.city_name, sc.state_name,
            sc.profile_image_r2_key, sc.aims, sc.modes, sc.status, sc.blocked_by_us, rn.label AS niche_label
       FROM influencer_group_members m
       JOIN scored sc ON sc.id = m.influencer_id
       LEFT JOIN ref_creator_niches rn ON rn.code = sc.niche_code
      WHERE m.group_id = $3
      ORDER BY m.added_at DESC`,
    [brand.id, subs, g[0].id]
  );
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  const members = rows.map(r => discovery.creatorRow(r));
  const states = await pickStates({ brandId: brand.id, set, ids: members.map(m => m.id), names: new Map(members.map(m => [m.id, m.name])) });
  const can = [], cannot = [];
  for (const m of members) {
    const p = states.get(m.id);
    // `label` beside the row is what every bundle already prints under her name; D2 puts the
    // short reason in it. `message` and `detail` ride beside it (null for "Already in this set").
    if (p.state === 'ok') can.push({ ...m, pick: p });
    else cannot.push({ ...m, pick: p, label: p.label, message: p.message || null, detail: p.detail || null });
  }
  return success(res, {
    group: { id: g[0].id, name: g[0].name, memberCount: members.length },
    set: { id: set.id, name: set.name, goal: set.goal, shootMode: set.shoot_mode, postingDate: set.go_live_date ? campaignState.describeSet(set).postingDate : null },
    counts: { can: can.length, cannot: cannot.length, total: members.length },
    can, cannot,
  });
});

/** A4 — POST /campaigns/:id/sets/:sid/eligibility { creators: [{ influencerId, fee?, commissionPct? }] } */
const checkEligibility = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  const creators = Array.isArray(req.body && req.body.creators) ? req.body.creators : [];
  if (!creators.length) throw new AppError('VALIDATION_ERROR', 'creators is required', 422, 'creators');
  if (creators.length > 100) throw new AppError('VALIDATION_ERROR', 'At most 100 creators per check', 422, 'creators');
  // D2: a refused creator's result also carries detail / label / message (null when she can be
  // invited). No names are handed over — the body is the client's, so the service looks them up.
  const results = await eligibility.canBrandInviteMany({ brandId: brand.id, set, creators });
  const inSet = await inSetMap(set.id, results.map(r => r.influencerId));
  return success(res, {
    results: results.map(r => ({ ...r, inSet: inSet.get(r.influencerId) || 'none', alreadyIn: inSet.get(r.influencerId) === 'live' })),
  });
});

/**
 * A8 — POST /campaigns/:id/sets/:sid/invitations
 *   { creators: [{ influencerId, terms, note?, offer?, sourceGroupId? }], sourceGroupId? }
 *
 * 2026-09-17: the group may now be named PER CREATOR. The picker's basket can hold a group, the
 * pool and hand-picked creators at once, so one label for the whole batch would be false for
 * most of the rows. The batch-level field still works and still applies to everyone who did not
 * bring her own, which is what an older bundle sends.
 *
 * Every id offered — batch or per creator — is checked against this brand before it is stored.
 * A group belonging to someone else is dropped to NULL, never trusted, never an error.
 */
const sendInvitations = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { campaign, set } = await ownedCampaignAndSet(req, brand.id);
  const body = req.body || {};
  const asked = new Set();
  const batchId = body.sourceGroupId || body.source_group_id || null;
  if (batchId) asked.add(batchId);
  for (const c of Array.isArray(body.creators) ? body.creators : []) {
    const g = c && (c.sourceGroupId || c.source_group_id);
    if (g) asked.add(g);
  }
  let mine = new Set();
  if (asked.size) {
    const { rows } = await db.query(
      `SELECT id FROM influencer_groups WHERE brand_id = $1 AND id = ANY($2::uuid[])`,
      [brand.id, [...asked]]
    );
    mine = new Set(rows.map(r => r.id));
  }
  const sourceGroupId = batchId && mine.has(batchId) ? batchId : null;
  const creators = (Array.isArray(body.creators) ? body.creators : []).map(c => {
    const g = c && (c.sourceGroupId || c.source_group_id);
    return { ...c, sourceGroupId: g && mine.has(g) ? g : undefined };
  });
  const out = await invitationSend.sendBatch({ brand, campaign, set, creators, sourceGroupId, actorUserId: req.user.sub });
  const counts = (await campaignState.countsForSets([set.id])).get(set.id) || campaignState.EMPTY_COUNTS;
  return success(res, { ...out, set: shapeSet(set, counts, null) }, 201);
});

/** A10 — GET /campaigns/:id/sets/:sid/invitations/:ciId */
const invitationDetail = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  const inv = await rowsSvc.invitationForBrand(req.params.ciId, set.id, set.goal);
  if (!inv) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  return success(res, { invitation: inv, set: { id: set.id, name: set.name, goal: set.goal, shootMode: set.shoot_mode } });
});

/** A11 — POST /campaigns/:id/sets/:sid/invitations/:ciId/withdraw */
const withdraw = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { campaign, set } = await ownedCampaignAndSet(req, brand.id);
  const ci = await invitationSend.withdraw({ brand, campaign, set, ciId: req.params.ciId, actorUserId: req.user.sub });
  return success(res, { id: ci.id, status: ci.status, withdrawnAt: ci.withdrawn_at });
});

/** A12 — POST /campaigns/:id/sets/:sid/invitations/:ciId/remove */
const remove = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { campaign, set } = await ownedCampaignAndSet(req, brand.id);
  const ci = await invitationSend.remove({ brand, campaign, set, ciId: req.params.ciId, actorUserId: req.user.sub });
  return success(res, { id: ci.id, status: ci.status, removedAt: ci.removed_at });
});

/* ─────────────────────────────────────────────────────────── creator */

/** A13 — GET /influencers/me/invitations?tab=invites|done */
const myInvitations = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, await rowsSvc.invitationsForCreator(influencerId, req.query.tab));
});

/** A14 — GET /influencers/me/invitations/:ciId */
const myInvitation = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const inv = await rowsSvc.invitationForCreator(req.params.ciId, influencerId);
  if (!inv) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  return success(res, { invitation: inv });
});

/** A15 — POST /influencers/me/invitations/:ciId/accept */
const accept = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const row = await invitationAnswer.loadForCreator(req.params.ciId, influencerId);
  if (!row) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  const { ci, contractError } = await invitationAnswer.accept(row);
  const inv = await rowsSvc.invitationForCreator(ci.id, influencerId);
  return success(res, { invitation: inv, contractPending: !!contractError });
});

/** A16 — POST /influencers/me/invitations/:ciId/decline { reason, note? } */
const decline = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const row = await invitationAnswer.loadForCreator(req.params.ciId, influencerId);
  if (!row) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  const { ci } = await invitationAnswer.decline(row, { reason: req.body && req.body.reason, note: req.body && req.body.note });
  const inv = await rowsSvc.invitationForCreator(ci.id, influencerId);
  return success(res, { invitation: inv });
});

/* ─────────────────────────────────── creator-terms-v2 (rules §2; T2, T3, T4, C2, C3) */

/** GET /campaigns/:id/sets/:sid/offer-choices — offers valid on the posting date or the day after. */
const offerChoices = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  if (!set.go_live_date) throw new AppError('INVITE_CLOSED', 'Set a posting date first.', 422, 'go_live_date');
  return success(res, await creatorTerms.offerChoices(brand.id, set.go_live_date));
});

/** GET /campaigns/:id/sets/:sid/products-without-offers?q&node&price_min&price_max — free on or after posting. */
const productsWithoutOffers = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  const { set } = await ownedCampaignAndSet(req, brand.id);
  if (!set.go_live_date) throw new AppError('INVITE_CLOSED', 'Set a posting date first.', 422, 'go_live_date');
  const products = await creatorTerms.freeProducts(brand.id, set.go_live_date, {
    q: req.query.q ? String(req.query.q) : null, node: req.query.node || null,
    price_min: req.query.price_min, price_max: req.query.price_max,
  });
  return success(res, { posting_date: String(set.go_live_date).slice(0, 10), products });
});

/** GET /influencers/me/invitations/:ciId/sell — C2, what she can sell (read-only). */
const mySell = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, await creatorTerms.creatorSell(influencerId, req.params.ciId));
});

/** GET /influencers/me/invitations/:ciId/offers/:offerId — C3, one offer (read-only). */
const myOffer = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, { offer: await creatorTerms.creatorOffer(influencerId, req.params.ciId, req.params.offerId) });
});

module.exports = {
  pickable, groupCheck, checkEligibility, sendInvitations, invitationDetail, withdraw, remove,
  myInvitations, myInvitation, accept, decline,
  workedWith, pickStates,
  offerChoices, productsWithoutOffers, mySell, myOffer,
};
