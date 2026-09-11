'use strict';

/**
 * collabSettings.controller.js — Item 2 HTTP layer.
 * Contract: features/item2-pitch-invitation-settings · rules v1.10 §8A · prompt §2.2, §4
 *
 *   GET/PUT  /brands/me/pitch-settings              (A1)  screens B1–B6
 *   GET/PUT  /influencers/me/invitation-settings    (A2)  screens C1–C6
 *   GET/POST /brands/me/blocked-creators, DELETE /:influencerId          (A3)  B7, X4
 *   GET/POST /influencers/me/blocked-brands, DELETE /:brandId            (A4)  C6, X3
 *   GET      /reference/creator-niches | languages | brand-categories | states  (A8)
 *
 * Validation runs on the server with the SAME messages the apps show (prompt §4). A
 * failing PUT answers 422 with error.field = the first failing field and
 * error.details.fields = every failure, so the screen can put each message under its own
 * control and count them for "Fix N things above to save".
 *
 * Block and unblock send NO notification — the blocked party is never told.
 */

const db = require('../config/db');
const elig = require('../services/collabEligibility.service');
const ref = require('../services/referenceLists.service');
const { resolveAvatars } = require('../utils/avatarResolver');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── The exact messages (prompt §4) ───────────────────────────────────────────
const MSG = Object.freeze({
  AIMS_BRAND:    'Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead.',
  AIMS_CREATOR:  'Pick at least one Aim. To stop all invitations, turn off Open to invitations instead.',
  MODES:         'Pick at least one mode of work.',
  WHOLE_NUMBER:  'Enter a whole number.',
  RATE_RANGE:    'Enter a rate between 0 and 100.',
  VISIT_CITIES:  'Pick at least one city, or turn off Store Visit.',
  WHOLE_RUPEES:  'Enter an amount in whole rupees.',
  COMMISSION:    'Commission must be between 1 and 100%.',
  UNKNOWN:       'One of the selected values is not on the list.',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function brandIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

function fail(errors) {
  if (!errors.length) return;
  const first = errors[0];
  throw new AppError('VALIDATION_ERROR', first.message, 422, first.field, { fields: errors });
}

const isBool = (v) => typeof v === 'boolean';
const isWholeNumberOrNull = (v) => v == null || v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0);
const toIntOrNull = (v) => (v == null || v === '' ? null : Number(v));
const isOneDecimalRate = (v) => {
  if (v == null || v === '') return true;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return false;
  return Math.round(n * 10) === n * 10;
};
const uniq = (arr) => [...new Set(arr)];

/** null/undefined = "any"; otherwise an array of strings. Returns null when "any". */
function listOrNull(v) {
  if (v == null) return null;
  if (!Array.isArray(v)) return undefined;             // wrong type
  const cleaned = uniq(v.map(x => String(x)).filter(Boolean));
  return cleaned.length ? cleaned : null;              // empty list = any
}
function intListOrNull(v) {
  if (v == null) return null;
  if (!Array.isArray(v)) return undefined;
  const cleaned = uniq(v.map(Number).filter(n => Number.isInteger(n) && n > 0));
  return cleaned.length ? cleaned : null;
}

// camelCase for the wire, snake_case in the database.
function brandOut(s) {
  return {
    accepting: s.accepting,
    pausedAt: s.paused_at,
    acceptedAims: s.accepted_aims,
    acceptedModes: s.accepted_modes,
    nicheCodes: s.niche_codes,
    minFollowersInstagram: s.min_followers_instagram,
    minFollowersYoutube: s.min_followers_youtube,
    minEngagementRate: s.min_engagement_rate,
    languageCodes: s.language_codes,
    cityIds: s.city_ids,
    allowPastCreators: s.allow_past_creators,
    updatedAt: s.updated_at,
    saved: !!s.saved,
  };
}
function creatorOut(s) {
  return {
    open: s.open,
    pausedAt: s.paused_at,
    acceptedAims: s.accepted_aims,
    acceptedModes: s.accepted_modes,
    visitCityIds: s.visit_city_ids || [],
    visitCitiesDefaulted: !!s.visit_cities_defaulted,
    brandCategoryCodes: s.brand_category_codes,
    minFeeEngagement: s.min_fee_engagement,
    minFeeHybrid: s.min_fee_hybrid,
    minCommissions: (s.min_commissions || []).map(r => ({ aim: r.aim, categoryCode: r.category_code, pct: r.pct })),
    updatedAt: s.updated_at,
    saved: !!s.saved,
  };
}

/** Pitches waiting for the brand's reply — the same definition Needs You uses. */
async function openPitchCount(brandId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM influencer_proposals p
      WHERE p.brand_id = $1
        AND (p.status IN ('sent','viewed')
             OR (p.status = 'countered' AND p.counter_by = 'creator'))`,
    [brandId]
  );
  return rows[0].n;
}
async function blockedCount(blockerType, blockerId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM collab_blocks WHERE blocker_type = $1 AND blocker_id = $2`,
    [blockerType, blockerId]
  );
  return rows[0].n;
}

// ═══════════════════════════════════════════════════════════════════════════
// A1 — Brand pitch settings
// ═══════════════════════════════════════════════════════════════════════════

const getBrandPitchSettings = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const s = await elig.loadBrandPitchSettings(brandId);
  const [openPitches, blocked, cities] = await Promise.all([
    openPitchCount(brandId),
    blockedCount('brand', brandId),
    ref.describeCityIds(s.city_ids || []),
  ]);
  return success(res, {
    settings: brandOut(s),
    openPitches,
    blockedCount: blocked,
    cityCounts: cities,                                   // { cities, states } for "N cities in N states"
    summary: { labelState: s.accepting ? 'accepting' : 'paused', aims: s.accepted_aims, modes: s.accepted_modes },
  });
});

const putBrandPitchSettings = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const current = await elig.loadBrandPitchSettings(brandId);
  const b = req.body || {};
  const errors = [];

  const accepting = isBool(b.accepting) ? b.accepting : current.accepting;

  const aims = Array.isArray(b.acceptedAims) ? uniq(b.acceptedAims.map(String)) : current.accepted_aims;
  if (!aims.length || aims.some(a => !elig.AIMS.includes(a))) {
    errors.push({ field: 'acceptedAims', code: 'AIMS_REQUIRED', message: MSG.AIMS_BRAND });
  }
  const modes = Array.isArray(b.acceptedModes) ? uniq(b.acceptedModes.map(String)) : current.accepted_modes;
  if (!modes.length || modes.some(m => !elig.MODES.includes(m))) {
    errors.push({ field: 'acceptedModes', code: 'MODES_REQUIRED', message: MSG.MODES });
  }

  if (!isWholeNumberOrNull(b.minFollowersInstagram)) {
    errors.push({ field: 'minFollowersInstagram', code: 'WHOLE_NUMBER', message: MSG.WHOLE_NUMBER });
  }
  if (!isWholeNumberOrNull(b.minFollowersYoutube)) {
    errors.push({ field: 'minFollowersYoutube', code: 'WHOLE_NUMBER', message: MSG.WHOLE_NUMBER });
  }
  if (!isOneDecimalRate(b.minEngagementRate)) {
    errors.push({ field: 'minEngagementRate', code: 'RATE_RANGE', message: MSG.RATE_RANGE });
  }

  const nicheCodes = 'nicheCodes' in b ? listOrNull(b.nicheCodes) : current.niche_codes;
  const languageCodes = 'languageCodes' in b ? listOrNull(b.languageCodes) : current.language_codes;
  const cityIds = 'cityIds' in b ? intListOrNull(b.cityIds) : current.city_ids;
  if (nicheCodes === undefined) errors.push({ field: 'nicheCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  if (languageCodes === undefined) errors.push({ field: 'languageCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  if (cityIds === undefined) errors.push({ field: 'cityIds', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });

  if (nicheCodes) {
    const bad = ref.unknownCodes(nicheCodes, await ref.creatorNiches());
    if (bad.length) errors.push({ field: 'nicheCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  }
  if (languageCodes) {
    const bad = ref.unknownCodes(languageCodes, await ref.languages());
    if (bad.length) errors.push({ field: 'languageCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  }
  if (cityIds) {
    const bad = await ref.unknownCityIds(cityIds);
    if (bad.length) errors.push({ field: 'cityIds', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  }
  fail(errors);

  const allowPast = isBool(b.allowPastCreators) ? b.allowPastCreators : current.allow_past_creators;
  const minIg = 'minFollowersInstagram' in b ? toIntOrNull(b.minFollowersInstagram) : current.min_followers_instagram;
  const minYt = 'minFollowersYoutube' in b ? toIntOrNull(b.minFollowersYoutube) : current.min_followers_youtube;
  const minEr = 'minEngagementRate' in b
    ? (b.minEngagementRate == null || b.minEngagementRate === '' ? null : Number(b.minEngagementRate))
    : current.min_engagement_rate;

  // paused_at: set when turned off, cleared when turned on. Unchanged otherwise.
  let pausedAt = current.paused_at;
  if (!accepting && current.accepting) pausedAt = new Date();
  if (accepting) pausedAt = null;

  await db.query(
    `INSERT INTO brand_pitch_settings
       (brand_id, accepting, paused_at, accepted_aims, accepted_modes, niche_codes,
        min_followers_instagram, min_followers_youtube, min_engagement_rate,
        language_codes, city_ids, allow_past_creators, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (brand_id) DO UPDATE SET
        accepting = EXCLUDED.accepting,
        paused_at = EXCLUDED.paused_at,
        accepted_aims = EXCLUDED.accepted_aims,
        accepted_modes = EXCLUDED.accepted_modes,
        niche_codes = EXCLUDED.niche_codes,
        min_followers_instagram = EXCLUDED.min_followers_instagram,
        min_followers_youtube = EXCLUDED.min_followers_youtube,
        min_engagement_rate = EXCLUDED.min_engagement_rate,
        language_codes = EXCLUDED.language_codes,
        city_ids = EXCLUDED.city_ids,
        allow_past_creators = EXCLUDED.allow_past_creators,
        updated_at = now()`,
    [brandId, accepting, pausedAt, aims, modes, nicheCodes, minIg, minYt, minEr, languageCodes, cityIds, allowPast]
  );

  const s = await elig.loadBrandPitchSettings(brandId);
  const [openPitches, blocked, cities] = await Promise.all([
    openPitchCount(brandId), blockedCount('brand', brandId), ref.describeCityIds(s.city_ids || []),
  ]);
  return success(res, {
    settings: brandOut(s), openPitches, blockedCount: blocked, cityCounts: cities,
    summary: { labelState: s.accepting ? 'accepting' : 'paused', aims: s.accepted_aims, modes: s.accepted_modes },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A2 — Creator invitation settings
// ═══════════════════════════════════════════════════════════════════════════

const getCreatorInvitationSettings = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const s = await elig.loadCreatorInvitationSettings(influencerId);
  const blocked = await blockedCount('creator', influencerId);
  return success(res, {
    settings: creatorOut(s),
    blockedCount: blocked,
    summary: { labelState: s.open ? 'open' : 'paused', aims: s.accepted_aims, modes: s.accepted_modes },
  });
});

const putCreatorInvitationSettings = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const current = await elig.loadCreatorInvitationSettings(influencerId);
  const b = req.body || {};
  const errors = [];

  const open = isBool(b.open) ? b.open : current.open;

  const aims = Array.isArray(b.acceptedAims) ? uniq(b.acceptedAims.map(String)) : current.accepted_aims;
  if (!aims.length || aims.some(a => !elig.AIMS.includes(a))) {
    errors.push({ field: 'acceptedAims', code: 'AIMS_REQUIRED', message: MSG.AIMS_CREATOR });
  }
  const modes = Array.isArray(b.acceptedModes) ? uniq(b.acceptedModes.map(String)) : current.accepted_modes;
  if (!modes.length || modes.some(m => !elig.MODES.includes(m))) {
    errors.push({ field: 'acceptedModes', code: 'MODES_REQUIRED', message: MSG.MODES });
  }

  let visitCityIds = 'visitCityIds' in b ? intListOrNull(b.visitCityIds) : current.visit_city_ids;
  if (visitCityIds === undefined) {
    errors.push({ field: 'visitCityIds', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
    visitCityIds = [];
  }
  visitCityIds = visitCityIds || [];
  if (modes.includes('visit') && visitCityIds.length === 0) {
    errors.push({ field: 'visitCityIds', code: 'VISIT_CITIES_REQUIRED', message: MSG.VISIT_CITIES });
  }
  if (visitCityIds.length) {
    const bad = await ref.unknownCityIds(visitCityIds);
    if (bad.length) errors.push({ field: 'visitCityIds', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  }

  const categories = 'brandCategoryCodes' in b ? listOrNull(b.brandCategoryCodes) : current.brand_category_codes;
  if (categories === undefined) {
    errors.push({ field: 'brandCategoryCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  } else if (categories) {
    const bad = ref.unknownCodes(categories, await ref.brandCategories());
    if (bad.length) errors.push({ field: 'brandCategoryCodes', code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
  }

  if (!isWholeNumberOrNull(b.minFeeEngagement)) {
    errors.push({ field: 'minFeeEngagement', code: 'WHOLE_RUPEES', message: MSG.WHOLE_RUPEES });
  }
  if (!isWholeNumberOrNull(b.minFeeHybrid)) {
    errors.push({ field: 'minFeeHybrid', code: 'WHOLE_RUPEES', message: MSG.WHOLE_RUPEES });
  }

  // Commission rows: [{ aim, categoryCode, pct }]. pct null/'' deletes that row.
  const knownCats = new Set((await ref.brandCategories()).map(c => c.code));
  knownCats.add('ALL');
  const rowsIn = Array.isArray(b.minCommissions) ? b.minCommissions : null;
  const upserts = [];
  const deletes = [];
  if (rowsIn) {
    rowsIn.forEach((r, i) => {
      const aim = String(r?.aim || '');
      const cat = String(r?.categoryCode || r?.category_code || '');
      const field = `minCommissions[${i}].pct`;
      if (!['conversion', 'hybrid'].includes(aim) || !knownCats.has(cat)) {
        errors.push({ field, code: 'UNKNOWN_CODE', message: MSG.UNKNOWN });
        return;
      }
      if (r.pct == null || r.pct === '') { deletes.push({ aim, cat }); return; }
      const pct = Number(r.pct);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        errors.push({ field, code: 'COMMISSION_RANGE', message: MSG.COMMISSION });
        return;
      }
      upserts.push({ aim, cat, pct });
    });
  }
  fail(errors);

  const minFeeEng = 'minFeeEngagement' in b ? toIntOrNull(b.minFeeEngagement) : current.min_fee_engagement;
  const minFeeHyb = 'minFeeHybrid' in b ? toIntOrNull(b.minFeeHybrid) : current.min_fee_hybrid;

  let pausedAt = current.paused_at;
  if (!open && current.open) pausedAt = new Date();
  if (open) pausedAt = null;

  await db.withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO creator_invitation_settings
         (influencer_id, open, paused_at, accepted_aims, accepted_modes, visit_city_ids,
          brand_category_codes, min_fee_engagement, min_fee_hybrid, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (influencer_id) DO UPDATE SET
          open = EXCLUDED.open,
          paused_at = EXCLUDED.paused_at,
          accepted_aims = EXCLUDED.accepted_aims,
          accepted_modes = EXCLUDED.accepted_modes,
          visit_city_ids = EXCLUDED.visit_city_ids,
          brand_category_codes = EXCLUDED.brand_category_codes,
          min_fee_engagement = EXCLUDED.min_fee_engagement,
          min_fee_hybrid = EXCLUDED.min_fee_hybrid,
          updated_at = now()`,
      [influencerId, open, pausedAt, aims, modes, visitCityIds, categories, minFeeEng, minFeeHyb]
    );
    for (const u of upserts) {
      await tx.query(
        `INSERT INTO creator_min_commissions (influencer_id, aim, category_code, pct, updated_at)
         VALUES ($1,$2,$3,$4, now())
         ON CONFLICT (influencer_id, aim, category_code) DO UPDATE SET pct = EXCLUDED.pct, updated_at = now()`,
        [influencerId, u.aim, u.cat, u.pct]
      );
    }
    for (const d of deletes) {
      await tx.query(
        `DELETE FROM creator_min_commissions WHERE influencer_id = $1 AND aim = $2 AND category_code = $3`,
        [influencerId, d.aim, d.cat]
      );
    }
  });

  const s = await elig.loadCreatorInvitationSettings(influencerId);
  const blocked = await blockedCount('creator', influencerId);
  return success(res, {
    settings: creatorOut(s),
    blockedCount: blocked,
    summary: { labelState: s.open ? 'open' : 'paused', aims: s.accepted_aims, modes: s.accepted_modes },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A3 — Brand: blocked creators
// ═══════════════════════════════════════════════════════════════════════════

const listBlockedCreators = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const { rows } = await db.query(
    `SELECT i.id AS influencer_id,
            COALESCE(i.full_name, u.name) AS name,
            i.instagram_handle,
            i.profile_image_url, i.profile_image_r2_key,
            cb.created_at AS blocked_at
       FROM collab_blocks cb
       JOIN influencers i ON i.id = cb.blocked_id
       JOIN users u ON u.id = i.user_id
      WHERE cb.blocker_type = 'brand' AND cb.blocker_id = $1 AND cb.blocked_type = 'creator'
      ORDER BY cb.created_at DESC`,
    [brandId]
  );
  await resolveAvatars(rows, { urlField: 'profile_image_url', keyField: 'profile_image_r2_key' });
  const blocked = rows.map(r => ({
    influencerId: r.influencer_id,
    name: r.name,
    instagramHandle: r.instagram_handle,
    avatarUrl: r.profile_image_url || null,
    blockedAt: r.blocked_at,
  }));
  return success(res, { blocked });
});

const blockCreator = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  const influencerId = req.body?.influencerId || req.body?.influencer_id;
  if (!influencerId) throw new AppError('VALIDATION_ERROR', 'influencerId is required', 422, 'influencerId');
  const { rows: inf } = await db.query(`SELECT id FROM influencers WHERE id = $1`, [influencerId]);
  if (!inf[0]) throw new AppError('NOT_FOUND', 'Creator not found', 404, 'influencerId');
  const { rows } = await db.query(
    `INSERT INTO collab_blocks (blocker_type, blocker_id, blocked_type, blocked_id)
     VALUES ('brand', $1, 'creator', $2)
     ON CONFLICT (blocker_type, blocker_id, blocked_type, blocked_id) DO NOTHING
     RETURNING id, created_at`,
    [brandId, influencerId]
  );
  // No notification. Existing pitches/invitations/collaborations untouched.
  return success(res, { blocked: true, influencerId, createdAt: rows[0]?.created_at || null }, rows[0] ? 201 : 200);
});

const unblockCreator = asyncHandler(async (req, res) => {
  const brandId = await brandIdOf(req.user.sub);
  await db.query(
    `DELETE FROM collab_blocks
      WHERE blocker_type = 'brand' AND blocker_id = $1 AND blocked_type = 'creator' AND blocked_id = $2`,
    [brandId, req.params.influencerId]
  );
  return success(res, { unblocked: true, influencerId: req.params.influencerId });
});

// ═══════════════════════════════════════════════════════════════════════════
// A4 — Creator: blocked brands
// ═══════════════════════════════════════════════════════════════════════════

const listBlockedBrands = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const { rows } = await db.query(
    `SELECT b.id AS brand_id, b.business_name AS name, b.logo_url, cb.created_at AS blocked_at
       FROM collab_blocks cb
       JOIN brands b ON b.id = cb.blocked_id
      WHERE cb.blocker_type = 'creator' AND cb.blocker_id = $1 AND cb.blocked_type = 'brand'
      ORDER BY cb.created_at DESC`,
    [influencerId]
  );
  const blocked = rows.map(r => ({ brandId: r.brand_id, name: r.name, logoUrl: r.logo_url || null, blockedAt: r.blocked_at }));
  return success(res, { blocked });
});

const blockBrand = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  const brandId = req.body?.brandId || req.body?.brand_id;
  if (!brandId) throw new AppError('VALIDATION_ERROR', 'brandId is required', 422, 'brandId');
  const { rows: br } = await db.query(`SELECT id FROM brands WHERE id = $1`, [brandId]);
  if (!br[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404, 'brandId');
  const { rows } = await db.query(
    `INSERT INTO collab_blocks (blocker_type, blocker_id, blocked_type, blocked_id)
     VALUES ('creator', $1, 'brand', $2)
     ON CONFLICT (blocker_type, blocker_id, blocked_type, blocked_id) DO NOTHING
     RETURNING id, created_at`,
    [influencerId, brandId]
  );
  return success(res, { blocked: true, brandId, createdAt: rows[0]?.created_at || null }, rows[0] ? 201 : 200);
});

const unblockBrand = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  await db.query(
    `DELETE FROM collab_blocks
      WHERE blocker_type = 'creator' AND blocker_id = $1 AND blocked_type = 'brand' AND blocked_id = $2`,
    [influencerId, req.params.brandId]
  );
  return success(res, { unblocked: true, brandId: req.params.brandId });
});

// ═══════════════════════════════════════════════════════════════════════════
// A8 — Reference lists (any signed-in role)
// ═══════════════════════════════════════════════════════════════════════════

const getCreatorNiches   = asyncHandler(async (_req, res) => success(res, { items: await ref.creatorNiches() }));
const getLanguages       = asyncHandler(async (_req, res) => success(res, { items: await ref.languages() }));
const getBrandCategories = asyncHandler(async (_req, res) => success(res, { items: await ref.brandCategories() }));
const getStates          = asyncHandler(async (_req, res) => success(res, { items: await ref.statesWithCities() }));

module.exports = {
  MSG,
  getBrandPitchSettings, putBrandPitchSettings,
  getCreatorInvitationSettings, putCreatorInvitationSettings,
  listBlockedCreators, blockCreator, unblockCreator,
  listBlockedBrands, blockBrand, unblockBrand,
  getCreatorNiches, getLanguages, getBrandCategories, getStates,
};
