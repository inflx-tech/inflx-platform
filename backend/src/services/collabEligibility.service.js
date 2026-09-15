'use strict';

/**
 * collabEligibility.service.js — who may start a collaboration with whom.
 * Contract: features/item2-pitch-invitation-settings · rules v1.10 §8A · prompt §3
 *
 * Two questions, answered in a fixed order so the first failure is the reason given:
 *
 *   canCreatorPitchBrand   — may this creator send this brand a pitch (aim, mode)?
 *   canBrandInviteCreator  — may this brand invite this creator into this set, and is
 *                            the proposed money below her minimums (a warning only)?
 *
 * PRIVACY IS THE POINT OF THIS FILE. Only three reason codes ever leave it — OK,
 * NOT_ACCEPTING, NOT_MATCHING — and NOT_ACCEPTING covers both "paused" and "blocked" so
 * a blocked party can never tell the difference. No threshold, list or minimum is ever
 * part of a result. The summaries handed to the other side carry only the accepted Aims
 * and modes and the paused/open state.
 *
 * MISSING ROW = DEFAULTS (founder Q7): a brand or creator who has never opened the
 * settings screen is fully open. Nothing is backfilled.
 *
 * NOT RETROACTIVE: this file is consulted only when a pitch or invitation is about to be
 * SENT (and when the other side looks at the screen). It never touches existing rows.
 */

const db = require('../config/db');
const ref = require('./referenceLists.service');

const AIMS  = Object.freeze(['conversion', 'engagement', 'hybrid']);
const MODES = Object.freeze(['visit', 'shipment']);

const REASON = Object.freeze({
  OK:            'OK',
  NOT_ACCEPTING: 'NOT_ACCEPTING',
  NOT_MATCHING:  'NOT_MATCHING',
  // Item 8, approval §2.1 — HER SCREEN ONLY. Returned by canCreatorPitchBrand,
  // which is a creator-side question and whose answer a brand never reads.
  // It never appears in canBrandInviteCreator or in inviteSummaryFor, so the
  // brand's three coarse codes are unchanged.
  BEING_MEASURED: 'BEING_MEASURED',
});
const WARNING = Object.freeze({
  BELOW_MIN_FEE:        'BELOW_MIN_FEE',
  BELOW_MIN_COMMISSION: 'BELOW_MIN_COMMISSION',
});

// The one place the coarse messages live, so the pitch route, the invite route and the
// screens cannot drift on wording.
const MESSAGE = Object.freeze({
  pitch: {
    NOT_ACCEPTING: "This brand isn't accepting pitches right now.",
    NOT_MATCHING:  "You don't match this brand's pitch criteria.",
    BEING_MEASURED: 'Your numbers are still being measured.',
  },
  invite: {
    NOT_ACCEPTING: "This creator isn't taking invitations right now.",
    NOT_MATCHING:  "This creator isn't open to this set.",
  },
});

// ── Effective settings (row merged over defaults) ───────────────────────────

const BRAND_DEFAULTS = Object.freeze({
  accepting: true,
  paused_at: null,
  accepted_aims: [...AIMS],
  accepted_modes: [...MODES],
  niche_codes: null,
  min_followers_instagram: null,
  min_followers_youtube: null,
  min_engagement_rate: null,
  language_codes: null,
  city_ids: null,
  allow_past_creators: true,
  updated_at: null,
});

const CREATOR_DEFAULTS = Object.freeze({
  open: true,
  paused_at: null,
  accepted_aims: [...AIMS],
  accepted_modes: [...MODES],
  visit_city_ids: [],
  brand_category_codes: null,
  min_fee_engagement: null,
  min_fee_hybrid: null,
  updated_at: null,
});

const num = (v) => (v == null ? null : Number(v));

/** The brand's pitch settings as they apply, plus `saved` (does a row exist). */
async function loadBrandPitchSettings(brandId) {
  const { rows } = await db.query(`SELECT * FROM brand_pitch_settings WHERE brand_id = $1`, [brandId]);
  const row = rows[0];
  if (!row) return { ...BRAND_DEFAULTS, brand_id: brandId, saved: false };
  return {
    brand_id: brandId,
    accepting: row.accepting,
    paused_at: row.paused_at,
    accepted_aims: row.accepted_aims,
    accepted_modes: row.accepted_modes,
    niche_codes: row.niche_codes,
    min_followers_instagram: num(row.min_followers_instagram),
    min_followers_youtube: num(row.min_followers_youtube),
    min_engagement_rate: num(row.min_engagement_rate),
    language_codes: row.language_codes,
    city_ids: row.city_ids,
    allow_past_creators: row.allow_past_creators,
    updated_at: row.updated_at,
    saved: true,
  };
}

/**
 * The creator's invitation settings as they apply, plus every stored minimum-commission
 * row (including rows for Aims/categories she has since unselected — the reader decides
 * what applies; the screen restores them when she re-selects).
 *
 * For a creator who has never saved, visit_city_ids defaults to her profile city when
 * that city is on the canonical list (rules: "defaults to the creator's own city").
 */
async function loadCreatorInvitationSettings(influencerId) {
  const [{ rows: srows }, { rows: crows }] = await Promise.all([
    db.query(`SELECT * FROM creator_invitation_settings WHERE influencer_id = $1`, [influencerId]),
    db.query(`SELECT aim, category_code, pct FROM creator_min_commissions WHERE influencer_id = $1 ORDER BY aim, category_code`, [influencerId]),
  ]);
  const minCommissions = crows.map(r => ({ aim: r.aim, category_code: r.category_code, pct: Number(r.pct) }));
  const row = srows[0];
  if (!row) {
    const cityId = await creatorProfileCityId(influencerId);
    return {
      ...CREATOR_DEFAULTS,
      influencer_id: influencerId,
      visit_city_ids: cityId ? [cityId] : [],
      visit_cities_defaulted: true,
      min_commissions: minCommissions,
      saved: false,
    };
  }
  return {
    influencer_id: influencerId,
    open: row.open,
    paused_at: row.paused_at,
    accepted_aims: row.accepted_aims,
    accepted_modes: row.accepted_modes,
    visit_city_ids: row.visit_city_ids || [],
    visit_cities_defaulted: false,
    brand_category_codes: row.brand_category_codes,
    min_fee_engagement: num(row.min_fee_engagement),
    min_fee_hybrid: num(row.min_fee_hybrid),
    updated_at: row.updated_at,
    min_commissions: minCommissions,
    saved: true,
  };
}

// ── Blocks ───────────────────────────────────────────────────────────────────

async function isBlocked(blockerType, blockerId, blockedType, blockedId) {
  const { rows } = await db.query(
    `SELECT 1 FROM collab_blocks
      WHERE blocker_type = $1 AND blocker_id = $2 AND blocked_type = $3 AND blocked_id = $4
      LIMIT 1`,
    [blockerType, blockerId, blockedType, blockedId]
  );
  return !!rows[0];
}

// ── Creator facts the rules read ─────────────────────────────────────────────

/** Canonical city id for a creator: the stored id, else her typed city matched by name. */
async function creatorProfileCityId(influencerId) {
  const { rows } = await db.query(
    `SELECT i.city_id, COALESCE(i.city, u.city) AS city_name
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE i.id = $1`,
    [influencerId]
  );
  const r = rows[0];
  if (!r) return null;
  if (r.city_id) return Number(r.city_id);
  return ref.cityIdForName(r.city_name);
}

async function creatorFacts(influencerId) {
  const { rows } = await db.query(
    `SELECT i.id, i.niche, i.language, i.followers_count, i.youtube_subscribers,
            i.engagement_rate, i.city_id, COALESCE(i.city, u.city) AS city_name
       FROM influencers i JOIN users u ON u.id = i.user_id
      WHERE i.id = $1`,
    [influencerId]
  );
  const r = rows[0];
  if (!r) return null;
  const cityId = r.city_id ? Number(r.city_id) : await ref.cityIdForName(r.city_name);
  return {
    niches: Array.isArray(r.niche) ? r.niche.map(String) : [],
    languages: Array.isArray(r.language) ? r.language.map(String) : [],
    followersInstagram: Number(r.followers_count || 0),
    // NULL = never measured → 0 for a minimum (founder Q16). She can still pass on Instagram.
    followersYoutube: Number(r.youtube_subscribers || 0),
    engagementRate: Number(r.engagement_rate || 0),
    cityId,
    // Item 8, approval §2.1 — which of those zeros are real zeros. Coercing a
    // null to zero is right for the comparison (she cannot be admitted on a
    // number nobody has), but it is wrong for the SENTENCE: "you don't meet
    // what they're looking for" and "we haven't measured you yet" are different
    // things, and only the second one she can wait out. Her screen gets the
    // difference; the brand still sees the three coarse codes.
    measured: {
      instagram: r.followers_count != null,
      youtube: r.youtube_subscribers != null,
      engagement: r.engagement_rate != null,
    },
  };
}

/**
 * "Previously signed agreement" = a contract carrying BOTH signatures on any earlier
 * collaboration between the two (founder Q3). A handshake that was agreed but never
 * signed (collab_agreements) does not count.
 */
async function hasSignedContractWith(influencerId, brandId) {
  const { rows } = await db.query(
    `SELECT 1
       FROM contracts con
       JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
       JOIN campaign_sets cs        ON cs.id = ci.set_id
       JOIN campaigns c             ON c.id  = cs.campaign_id
      WHERE ci.influencer_id = $1 AND c.brand_id = $2
        AND con.influencer_signed_at IS NOT NULL
        AND con.brand_signed_at      IS NOT NULL
      LIMIT 1`,
    [influencerId, brandId]
  );
  return !!rows[0];
}

// ── Brand facts the rules read ───────────────────────────────────────────────

async function brandFacts(brandId) {
  const { rows } = await db.query(
    `SELECT b.id, b.sub_categories, b.listing_data, u.city AS user_city
       FROM brands b JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [brandId]
  );
  const r = rows[0];
  if (!r) return null;
  // Branch cities are typed free-hand until item 3; match each by name. The brand's own
  // registration city counts as a branch too — it IS the main branch for most brands.
  const branches = Array.isArray(r.listing_data?.branches) ? r.listing_data.branches : [];
  const names = branches.map(b => b && b.city).filter(Boolean);
  if (r.user_city) names.push(r.user_city);
  // Item 3: the branch table is the truth; the typed names remain a fallback for a brand
  // whose rows have not been written yet.
  const { rows: tbl } = await db.query(`SELECT DISTINCT city_id FROM brand_branches WHERE brand_id = $1 AND city_id IS NOT NULL`, [brandId]);
  const branchCityIds = tbl.length ? tbl.map(r => Number(r.city_id)) : await ref.cityIdsForNames(names);
  return {
    subCategories: Array.isArray(r.sub_categories) ? r.sub_categories : [],
    branchCityIds,
  };
}

// ── Mode normalisation (founder Q9) ─────────────────────────────────────────
// The rules have two modes; the system also has 'remote' (= no shoot). 'remote' is
// checked as Remote/shipment. A set with no mode yet skips the mode check.
function normaliseMode(mode) {
  const m = String(mode || '').toLowerCase();
  if (!m) return null;
  if (m === 'remote') return 'shipment';
  return m;
}

const overlaps = (a, b) => (a || []).some(x => (b || []).includes(x));

// ── §3.1 Creator → Brand ─────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {string} p.influencerId
 * @param {string} p.brandId
 * @param {string} [p.aim]   conversion | engagement | hybrid  (absent = skip the aim check)
 * @param {string} [p.mode]  visit | shipment | remote          (absent = skip the mode check)
 * @returns {{ ok: boolean, reason: string }}
 */
async function canCreatorPitchBrand({ influencerId, brandId, aim, mode }) {
  const settings = await loadBrandPitchSettings(brandId);

  // 1. Not accepting, or blocked → NOT_ACCEPTING. Identical either way.
  if (!settings.accepting) return { ok: false, reason: REASON.NOT_ACCEPTING };
  if (await isBlocked('brand', brandId, 'creator', influencerId)) {
    return { ok: false, reason: REASON.NOT_ACCEPTING };
  }

  // 2. Aim / mode.
  if (aim && !settings.accepted_aims.includes(String(aim).toLowerCase())) {
    return { ok: false, reason: REASON.NOT_MATCHING };
  }
  const m = normaliseMode(mode);
  if (m && !settings.accepted_modes.includes(m)) {
    return { ok: false, reason: REASON.NOT_MATCHING };
  }

  // 3. A creator the brand has signed with before skips the private filters — and only
  //    those (founder Q2). Never steps 1–2.
  if (settings.allow_past_creators && await hasSignedContractWith(influencerId, brandId)) {
    return { ok: true, reason: REASON.OK };
  }

  // 4. Private filters. Each is skipped when null/"any".
  const f = await creatorFacts(influencerId);
  if (!f) return { ok: false, reason: REASON.NOT_MATCHING };

  if (Array.isArray(settings.niche_codes) && settings.niche_codes.length) {
    if (!overlaps(f.niches, settings.niche_codes)) return { ok: false, reason: REASON.NOT_MATCHING };
  }

  const minIg = settings.min_followers_instagram;
  const minYt = settings.min_followers_youtube;
  if (minIg != null || minYt != null) {
    // Either platform is enough — but only a platform the brand set a minimum FOR counts.
    const passIg = minIg != null && f.followersInstagram >= minIg;
    const passYt = minYt != null && f.followersYoutube   >= minYt;
    if (!passIg && !passYt) {
      // She fails — but if a platform the brand asked about has never been
      // measured, she may pass once it is, and saying "you don't match" would
      // be telling her something untrue about herself (approval §2.1).
      const awaiting = (minIg != null && !f.measured.instagram) || (minYt != null && !f.measured.youtube);
      return { ok: false, reason: awaiting ? REASON.BEING_MEASURED : REASON.NOT_MATCHING };
    }
  }

  if (settings.min_engagement_rate != null && f.engagementRate < settings.min_engagement_rate) {
    return { ok: false, reason: f.measured.engagement ? REASON.NOT_MATCHING : REASON.BEING_MEASURED };
  }

  if (Array.isArray(settings.language_codes) && settings.language_codes.length) {
    if (!overlaps(f.languages, settings.language_codes)) return { ok: false, reason: REASON.NOT_MATCHING };
  }

  if (Array.isArray(settings.city_ids) && settings.city_ids.length) {
    if (!f.cityId || !settings.city_ids.map(Number).includes(f.cityId)) {
      return { ok: false, reason: REASON.NOT_MATCHING };
    }
  }

  // 5.
  return { ok: true, reason: REASON.OK };
}

// ── §3.2 Brand → Creator ─────────────────────────────────────────────────────

/**
 * Item 8, §7B — the pool entry that came from her OWN pitch, for THIS set's shape.
 *
 * "Where the pool entry came from a Pitch the Creator herself sent, her Pitch is
 * the more recent and more specific statement: for a Set that matches what was
 * agreed — the same Aim and the same Mode of Work — her Aim, Mode, city,
 * category and minimum settings are not applied against her." (rules v1.21 §7B)
 *
 * Matching is the Aim AND the mode, both, and only a pool entry still waiting.
 * A set that differs in either is an ordinary pick and every setting applies.
 */
async function agreedPitchFor(influencerId, brandId, set) {
  const mode = normaliseMode(set && set.shoot_mode);
  const aim = String((set && set.goal) || '').toLowerCase();
  if (!aim || !mode) return null;
  const { rows } = await db.query(
    `SELECT id FROM brand_creator_pool
      WHERE influencer_id = $1 AND brand_id = $2 AND from_pitch_id IS NOT NULL
        AND state = 'waiting' AND expires_at > now()
        AND goal = $3 AND matched_shoot_mode = $4
      ORDER BY agreed_at DESC LIMIT 1`,
    [influencerId, brandId, aim, mode]
  );
  return rows[0] || null;
}


/**
 * @param {object} p
 * @param {string} p.brandId
 * @param {string} p.influencerId
 * @param {object} p.set             { goal, shoot_mode }  (goal = the set's Aim)
 * @param {object} [p.proposedTerms] { fee, commissionPct }  whole rupees / percent
 * @returns {{ ok: boolean, reason: string, warnings: string[] }}
 */
async function canBrandInviteCreator({ brandId, influencerId, set, proposedTerms }) {
  const settings = await loadCreatorInvitationSettings(influencerId);
  const warnings = [];

  // 1. Not open, or blocked → NOT_ACCEPTING.
  if (!settings.open) return { ok: false, reason: REASON.NOT_ACCEPTING, warnings };
  if (await isBlocked('creator', influencerId, 'brand', brandId)) {
    return { ok: false, reason: REASON.NOT_ACCEPTING, warnings };
  }

  // Item 8, §7B: she pitched this brand for exactly this shape and it agreed, so
  // her own filters are not turned against her. Only the two absolutes above
  // survive — "a Creator who has since paused invitations, or who has since
  // blocked that Brand, cannot be invited" — and they are already checked.
  const herOwnPitch = await agreedPitchFor(influencerId, brandId, set);

  // 2. The set's Aim and mode.
  const aim = String(set?.goal || '').toLowerCase();
  if (!herOwnPitch && aim && !settings.accepted_aims.includes(aim)) {
    return { ok: false, reason: REASON.NOT_MATCHING, warnings };
  }
  const mode = normaliseMode(set?.shoot_mode);
  if (!herOwnPitch && mode && !settings.accepted_modes.includes(mode)) {
    return { ok: false, reason: REASON.NOT_MATCHING, warnings };
  }

  const brand = await brandFacts(brandId);
  if (!brand) return { ok: false, reason: REASON.NOT_MATCHING, warnings };

  // 3. Brand categories. A brand with none set does not match a creator who picked
  //    categories (founder Q5c). Creators who picked none are unaffected.
  const picked = Array.isArray(settings.brand_category_codes) ? settings.brand_category_codes : null;
  if (!herOwnPitch && picked && picked.length) {
    if (!overlaps(brand.subCategories, picked)) return { ok: false, reason: REASON.NOT_MATCHING, warnings };
  }

  // Item 4 — a set names ONE branch. Store Visit is checked against that branch's city, not
  // every branch the brand owns. A set without a branch (built before item 4) keeps the
  // brand-wide check below.
  if (mode === 'visit' && set && set.branch_id) {
    const { rows: br } = await db.query(`SELECT city_id FROM brand_branches WHERE id = $1`, [set.branch_id]);
    brand.branchCityIds = br[0] && br[0].city_id != null ? [Number(br[0].city_id)] : [];
  }
  // 4. Store Visit: at least one branch city must be somewhere she can travel (founder Q1).
  if (!herOwnPitch && mode === 'visit') {
    const visit = (settings.visit_city_ids || []).map(Number);
    if (!brand.branchCityIds.some(id => visit.includes(Number(id)))) {
      return { ok: false, reason: REASON.NOT_MATCHING, warnings };
    }
  }

  // 5. OK — plus soft warnings. These never block.
  //    Her minimums are hers to waive, and pitching below them waived them: the
  //    brand is not warned about a bar she herself came in under (§7B).
  if (herOwnPitch) return { ok: true, reason: REASON.OK, warnings: [], minimums: null, fromHerPitch: true };

  const fee = proposedTerms?.fee;
  const commission = proposedTerms?.commissionPct;

  if (aim === 'engagement' && fee != null && settings.min_fee_engagement != null
      && Number(fee) < settings.min_fee_engagement) {
    warnings.push(WARNING.BELOW_MIN_FEE);
  }
  if (aim === 'hybrid' && fee != null && settings.min_fee_hybrid != null
      && Number(fee) < settings.min_fee_hybrid) {
    warnings.push(WARNING.BELOW_MIN_FEE);
  }

  const minCommission = (aim === 'conversion' || aim === 'hybrid') ? minCommissionFor(settings, aim, brand.subCategories) : null;
  if (minCommission != null && commission != null && Number(commission) < minCommission) warnings.push(WARNING.BELOW_MIN_COMMISSION);

  // Item 5 (A4): her minimums for THIS Aim and THIS brand, so the terms screen can print
  // "Below Priya's minimum of 12%". Handed to the BRAND only — a creator endpoint never
  // forwards this object (rules §8A: thresholds are private to the other side, but the
  // creator's own minimum shown to the brand proposing terms is what the warning IS).
  const minFee = aim === 'engagement' ? settings.min_fee_engagement : aim === 'hybrid' ? settings.min_fee_hybrid : null;
  const minimums = { fee: minFee != null ? Number(minFee) : null, commissionPct: minCommission != null ? Number(minCommission) : null };

  return { ok: true, reason: REASON.OK, warnings, minimums };
}

/**
 * Item 5 (A4) — the same check for a list of creators against one set. One result per
 * creator, in input order; a creator that does not exist reads as NOT_MATCHING.
 * @param {{brandId:string, set:object, creators:Array<{influencerId:string, fee?:number, commissionPct?:number}>}} p
 * @returns {Promise<Array<{influencerId:string, ok:boolean, reason:string, warnings:string[], minimums:object|null}>>}
 */
async function canBrandInviteMany({ brandId, set, creators }) {
  const out = [];
  for (const c of creators || []) {
    const influencerId = c.influencerId || c.influencer_id;
    if (!influencerId) continue;
    try {
      const r = await canBrandInviteCreator({ brandId, influencerId, set, proposedTerms: { fee: c.fee, commissionPct: c.commissionPct } });
      out.push({ influencerId, ok: r.ok, reason: r.reason, warnings: r.warnings || [], minimums: r.minimums || null });
    } catch (e) {
      out.push({ influencerId, ok: false, reason: REASON.NOT_MATCHING, warnings: [], minimums: null });
    }
  }
  return out;
}

/**
 * The creator's minimum commission that applies to this brand for this Aim.
 *  - She picked categories → the row for (aim, the brand's category). Step 3 already
 *    guarantees at least one of the brand's categories is one she picked; when the brand
 *    has several that she picked, the LOWEST of her rows applies (the brand can honestly
 *    meet her bar for one of its industries).
 *  - She picked none → the (aim, 'ALL') row.
 *  - No row → no minimum.
 */
function minCommissionFor(settings, aim, brandSubCategories) {
  const rows = (settings.min_commissions || []).filter(r => r.aim === aim);
  const picked = Array.isArray(settings.brand_category_codes) ? settings.brand_category_codes : null;
  if (picked && picked.length) {
    const candidates = rows
      .filter(r => picked.includes(r.category_code) && (brandSubCategories || []).includes(r.category_code))
      .map(r => r.pct);
    return candidates.length ? Math.min(...candidates) : null;
  }
  const all = rows.find(r => r.category_code === 'ALL');
  return all ? all.pct : null;
}

// ── What the other side sees ─────────────────────────────────────────────────

/**
 * The brand overview card for a creator viewer. Blocked ⇒ byte-identical to paused.
 * Evaluated with her profile only (no aim/mode chosen yet).
 */
async function pitchSummaryFor(brandId, viewerInfluencerId) {
  const s = await loadBrandPitchSettings(brandId);
  const blocked = viewerInfluencerId
    ? await isBlocked('brand', brandId, 'creator', viewerInfluencerId)
    : false;
  const paused = !s.accepting || blocked;
  let canPitch = false;
  let reason = REASON.NOT_ACCEPTING;
  if (!paused && viewerInfluencerId) {
    const r = await canCreatorPitchBrand({ influencerId: viewerInfluencerId, brandId });
    canPitch = r.ok;
    reason = r.reason;
  } else if (!paused) {
    canPitch = true;
    reason = REASON.OK;
  }

  // Item 8 — a cooldown is a pause with a date on it, and the overview says
  // when. Read BELOW the paused check on purpose: a block must keep looking
  // exactly like a pause, so it masks the cooldown rather than the reverse
  // (gap report §5, confirmed in the founder's answer 5).
  let cooldownUntil = null;
  if (!paused && viewerInfluencerId) {
    const { rows } = await db.query(
      `SELECT cooldown_until FROM proposal_cooldowns
        WHERE influencer_id = $1 AND brand_id = $2 AND cooldown_until > now()`,
      [viewerInfluencerId, brandId]
    );
    if (rows[0]) {
      cooldownUntil = rows[0].cooldown_until;
      canPitch = false;
      reason = 'COOLDOWN';
    }
  }

  return {
    acceptingLabelState: paused ? 'paused' : 'accepting',
    aims: s.accepted_aims,
    modes: s.accepted_modes,
    canPitch,
    reason,
    cooldownUntil,
    cooldownLine: cooldownUntil
      ? require('./pitchCopy').CREATOR.cooldownLine(await brandNameOf(brandId), cooldownUntil)
      : null,
  };
}

const brandNameOf = async (brandId) => {
  const { rows } = await db.query(`SELECT business_name FROM brands WHERE id = $1`, [brandId]);
  return rows[0] ? rows[0].business_name : 'this brand';
};

/** The creator profile card for a brand viewer. Blocked ⇒ byte-identical to paused. */
async function inviteSummaryFor(influencerId, viewerBrandId) {
  const s = await loadCreatorInvitationSettings(influencerId);
  const blocked = viewerBrandId
    ? await isBlocked('creator', influencerId, 'brand', viewerBrandId)
    : false;
  const paused = !s.open || blocked;
  let canInvite = false;
  let reason = REASON.NOT_ACCEPTING;
  if (!paused && viewerBrandId) {
    // No set yet: steps 1 and 3 only (brand categories), which is what the profile can know.
    const r = await canBrandInviteCreator({ brandId: viewerBrandId, influencerId, set: {} });
    canInvite = r.ok;
    reason = r.reason;
  } else if (!paused) {
    canInvite = true;
    reason = REASON.OK;
  }
  return {
    openLabelState: paused ? 'paused' : 'open',
    aims: s.accepted_aims,
    modes: s.accepted_modes,
    canInvite,
    reason,
  };
}

module.exports = {
  AIMS, MODES, REASON, WARNING, MESSAGE,
  BRAND_DEFAULTS, CREATOR_DEFAULTS,
  loadBrandPitchSettings,
  loadCreatorInvitationSettings,
  isBlocked,
  hasSignedContractWith,
  creatorProfileCityId,
  brandFacts,
  canCreatorPitchBrand,
  agreedPitchFor,
  canBrandInviteCreator,
  canBrandInviteMany,
  minCommissionFor,
  normaliseMode,
  pitchSummaryFor,
  inviteSummaryFor,
};
