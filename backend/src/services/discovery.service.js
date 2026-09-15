'use strict';

/**
 * discovery.service.js — Discover creators, Find brands, and the set-based status helpers
 * behind them (and behind group counts).
 * Contract: features/item3-discovery-profiles-groups · rules v1.11 §5A, §8, §8A · prompt §6.2, §6.6
 *
 * ONE QUERY PER PAGE, NEVER ONE PER CREATOR (founder decision 8). Item 2's per-pair
 * functions stay the truth for a send; these SQL expressions are their brand-level /
 * profile-level equivalents, computed for a whole page or a whole group in one statement.
 *
 * Brand-level status of a creator for a brand (prompt §6.2, item 2 steps 1 + 3):
 *   NOT_ACCEPTING  paused, or the creator has blocked this brand
 *   NOT_MATCHING   she picked brand categories and none of the brand's sub-categories is in them
 *                  (a brand with none set does not match — founder Q5c, item 2)
 *   OK             otherwise
 * Set-level rules (aim, mode, visit cities, minimums) are item 5's.
 *
 * Profile-level status of a brand for a creator (prompt §6.6 = item 2 pitchSummary):
 *   NOT_ACCEPTING  brand paused, or the brand has blocked her
 *   NOT_MATCHING   she fails one of the brand's private filters (niche, followers either
 *                  platform, engagement, languages, city) unless she has a signed contract
 *                  with the brand and the brand allows past creators
 *   OK             otherwise
 *
 * Privacy: these queries SELECT only what the other side may see. No threshold, list or
 * block detail is ever returned — only the coarse status.
 */

const db = require('../config/db');
const { resolveAvatars } = require('../utils/avatarResolver');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
// Item 8 — the two sentences her brand list can say beyond the coarse codes.
const PITCH_COPY = require('./pitchCopy');

const AIMS_ALL = "ARRAY['conversion','engagement','hybrid']::text[]";
const MODES_ALL = "ARRAY['visit','shipment']::text[]";
const PAGE = 20;

// ── Shared SQL pieces ─────────────────────────────────────────────────────────

/**
 * Creators as a brand may see them, with the brand-level status. $1 = brand id,
 * $2 = the brand's sub_categories (text[]; NULL when none set).
 * Every consumer adds its own WHERE on top of `base`.
 */
const CREATOR_BASE_CTE = `
  base AS (
    SELECT i.id,
           COALESCE(i.full_name, u.name)                          AS name,
           i.instagram_handle, i.youtube_handle,
           i.niche[1]                                             AS niche_code,
           i.language                                             AS languages,
           i.followers_count, i.youtube_subscribers, i.engagement_rate,
           GREATEST(i.scrape_last_run, i.youtube_scrape_last_run) AS measured_at,
           i.city_id, rc.name AS city_name, rs.name AS state_name,
           i.profile_image_r2_key,
           COALESCE(i.approved_at, u.created_at)                  AS approved_order,
           COALESCE(s.open, true)                                 AS open,
           COALESCE(s.accepted_aims,  ${AIMS_ALL})                AS aims,
           COALESCE(s.accepted_modes, ${MODES_ALL})               AS modes,
           s.brand_category_codes,
           EXISTS (SELECT 1 FROM collab_blocks cb
                    WHERE cb.blocker_type = 'creator' AND cb.blocker_id = i.id
                      AND cb.blocked_type = 'brand'   AND cb.blocked_id = $1)  AS blocked_us,
           EXISTS (SELECT 1 FROM collab_blocks cb
                    WHERE cb.blocker_type = 'brand'   AND cb.blocker_id = $1
                      AND cb.blocked_type = 'creator' AND cb.blocked_id = i.id) AS blocked_by_us
      FROM influencers i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN creator_invitation_settings s ON s.influencer_id = i.id
      LEFT JOIN ref_cities rc ON rc.id = i.city_id
      LEFT JOIN ref_states rs ON rs.id = rc.state_id
     WHERE u.status = 'approved' AND u.role = 'influencer'
  ),
  scored AS (
    SELECT b.*,
           CASE WHEN NOT b.open OR b.blocked_us THEN 'NOT_ACCEPTING'
                WHEN b.brand_category_codes IS NOT NULL AND cardinality(b.brand_category_codes) > 0
                     AND NOT (b.brand_category_codes::text[] && COALESCE($2::text[], '{}'::text[])) THEN 'NOT_MATCHING'
                ELSE 'OK' END AS status
      FROM base b
  )`;

async function brandSubCategories(brandId) {
  const { rows } = await db.query(`SELECT sub_categories FROM brands WHERE id = $1`, [brandId]);
  return rows[0] ? rows[0].sub_categories : null;
}

/** Map<influencerId, 'OK'|'NOT_ACCEPTING'|'NOT_MATCHING'> for up to hundreds of creators in one query. */
async function statusForCreators(brandId, influencerIds) {
  const ids = [...new Set((influencerIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const subs = await brandSubCategories(brandId);
  const { rows } = await db.query(
    `WITH ${CREATOR_BASE_CTE}
     SELECT id, status, blocked_by_us FROM scored WHERE id = ANY($3::uuid[])`,
    [brandId, subs, ids]
  );
  return new Map(rows.map(r => [r.id, r.status]));
}

const clean = (v) => (v == null || v === '' ? null : v);
const arr = (v) => (v == null ? null : (Array.isArray(v) ? v : String(v).split(',')).map(x => String(x).trim()).filter(Boolean));
const intOrNull = (v) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v != null ? n : null; };

/**
 * Discover creators (A5). Returns { total, page, rows } or { total } when countOnly.
 * `withGroups` attaches groupIds[] for the viewing brand's groups (G6 ticks).
 */
async function discoverCreators(brandId, q = {}) {
  const subs = await brandSubCategories(brandId);
  const params = [brandId, subs];
  const where = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };

  const openOnly = q.openOnly === undefined ? true : !(q.openOnly === false || q.openOnly === 'false' || q.openOnly === '0' || q.openOnly === 0);
  if (openOnly) where.push(`s.status = 'OK'`);

  const search = clean(q.search);
  if (search) {
    const term = String(search).trim().replace(/^@+/, '').toLowerCase();
    const like = p(`%${term}%`);
    where.push(`(lower(s.name) LIKE ${like} OR lower(s.instagram_handle) LIKE ${like} OR lower(s.youtube_handle) LIKE ${like})`);
  }
  const niches = arr(q.nicheCodes);
  if (niches && niches.length) where.push(`s.niche_code = ANY(${p(niches)}::text[])`);
  const minIg = intOrNull(q.minInstagram);
  if (minIg != null && minIg > 0) where.push(`COALESCE(s.followers_count, 0) >= ${p(minIg)}`);
  const minYt = intOrNull(q.minYoutube);
  if (minYt != null && minYt > 0) where.push(`COALESCE(s.youtube_subscribers, 0) >= ${p(minYt)}`);
  const minEr = q.minEngagement == null || q.minEngagement === '' ? null : Number(q.minEngagement);
  if (minEr != null && Number.isFinite(minEr) && minEr > 0) where.push(`s.engagement_rate IS NOT NULL AND s.engagement_rate >= ${p(minEr)}`);
  const cityIds = arr(q.cityIds);
  if (cityIds && cityIds.length) where.push(`s.city_id = ANY(${p(cityIds.map(Number).filter(Number.isFinite))}::int[])`);
  const langs = arr(q.languageCodes);
  if (langs && langs.length) where.push(`s.languages::text[] && ${p(langs)}::text[]`);
  const aims = arr(q.aims);
  if (aims && aims.length) where.push(`s.aims::text[] && ${p(aims)}::text[]`);
  const modes = arr(q.modes);
  if (modes && modes.length) where.push(`s.modes::text[] && ${p(modes)}::text[]`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countSql = `WITH ${CREATOR_BASE_CTE} SELECT count(*)::int AS n FROM scored s ${whereSql}`;
  const { rows: cnt } = await db.query(countSql, params);
  const total = cnt[0].n;
  if (q.countOnly === true || q.countOnly === '1' || q.countOnly === 'true') return { total };

  const sort = q.sort === 'engagement' ? 's.engagement_rate DESC NULLS LAST, s.followers_count DESC NULLS LAST'
    : q.sort === 'newest' ? 's.approved_order DESC'
    : 'GREATEST(COALESCE(s.followers_count, 0), COALESCE(s.youtube_subscribers, 0)) DESC, s.name ASC';
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const off = p((page - 1) * PAGE);
  const lim = p(PAGE);
  const { rows } = await db.query(
    `WITH ${CREATOR_BASE_CTE}
     SELECT s.id, s.name, s.instagram_handle, s.youtube_handle, s.niche_code, s.languages, s.followers_count,
            s.youtube_subscribers, s.engagement_rate, s.measured_at, s.city_id, s.city_name, s.state_name,
            s.profile_image_r2_key, s.aims, s.modes, s.status, s.blocked_by_us,
            rn.label AS niche_label
       FROM scored s LEFT JOIN ref_creator_niches rn ON rn.code = s.niche_code
       ${whereSql}
      ORDER BY ${sort}
      LIMIT ${lim} OFFSET ${off}`,
    params
  );

  let groupIdsByCreator = new Map();
  if (q.withGroups && rows.length) {
    const { rows: g } = await db.query(
      `SELECT m.influencer_id, m.group_id FROM influencer_group_members m
         JOIN influencer_groups gr ON gr.id = m.group_id
        WHERE gr.brand_id = $1 AND m.influencer_id = ANY($2::uuid[])`,
      [brandId, rows.map(r => r.id)]
    );
    for (const r of g) {
      if (!groupIdsByCreator.has(r.influencer_id)) groupIdsByCreator.set(r.influencer_id, []);
      groupIdsByCreator.get(r.influencer_id).push(r.group_id);
    }
  }

  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  return {
    total, page,
    rows: rows.map(r => creatorRow(r, groupIdsByCreator.get(r.id) || (q.withGroups ? [] : undefined))),
  };
}

/** The public shape of a creator row. Nothing private. */
function creatorRow(r, groupIds) {
  const out = {
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url || null,
    instagramHandle: r.instagram_handle || null,
    youtubeHandle: r.youtube_handle || null,
    nicheCode: r.niche_code || null,
    nicheLabel: r.niche_label || null,
    cityName: r.city_name || null,
    stateName: r.state_name || null,
    languages: Array.isArray(r.languages) ? r.languages : [],
    instagram: r.followers_count == null ? null : Number(r.followers_count),
    youtube: r.youtube_subscribers == null ? null : Number(r.youtube_subscribers),
    engagement: r.engagement_rate == null ? null : Number(r.engagement_rate),
    measuredAt: r.measured_at || null,
    acceptedAims: r.aims,
    acceptedModes: r.modes,
    status: r.status,
    blockedByYou: !!r.blocked_by_us,
  };
  if (groupIds !== undefined) out.groupIds = groupIds;
  return out;
}

// ── Find brands (A9) ─────────────────────────────────────────────────────────

/**
 * Brands as a creator may see them, with the profile-level status. $1 = influencer id.
 * The creator's facts are read once into a CTE; the brand's private filters are compared
 * in SQL; nothing about them is selected.
 */
const BRAND_BASE_CTE = `
  me AS (
    SELECT i.id, i.niche, i.language, COALESCE(i.followers_count, 0) AS ig, COALESCE(i.youtube_subscribers, 0) AS yt,
           COALESCE(i.engagement_rate, 0) AS er, i.city_id,
           -- Item 8, approval §2.1: which of those zeros are real zeros. The
           -- comparison still uses the coerced value; only the reason code
           -- changes, and only on HER list. Must stay in step with
           -- collabEligibility.canCreatorPitchBrand — check 41 pins them.
           (i.followers_count      IS NOT NULL) AS ig_measured,
           (i.youtube_subscribers  IS NOT NULL) AS yt_measured,
           (i.engagement_rate      IS NOT NULL) AS er_measured
      FROM influencers i WHERE i.id = $1
  ),
  base AS (
    SELECT b.id, b.business_name AS name, b.logo_url, b.sub_categories, b.about,
           COALESCE(b.approved_at, u.created_at) AS approved_order,
           (SELECT rc.name FROM brand_branches bb JOIN ref_cities rc ON rc.id = bb.city_id
             WHERE bb.brand_id = b.id AND bb.is_main LIMIT 1) AS main_city,
           (SELECT count(*)::int FROM brand_products bp WHERE bp.brand_id = b.id AND bp.is_active AND bp.pushed_to_store) AS product_count,
           COALESCE(ps.accepting, true) AS accepting,
           COALESCE(ps.accepted_aims,  ${AIMS_ALL})  AS aims,
           COALESCE(ps.accepted_modes, ${MODES_ALL}) AS modes,
           ps.niche_codes, ps.min_followers_instagram, ps.min_followers_youtube, ps.min_engagement_rate,
           ps.language_codes, ps.city_ids, COALESCE(ps.allow_past_creators, true) AS allow_past,
           EXISTS (SELECT 1 FROM collab_blocks cb
                    WHERE cb.blocker_type = 'brand' AND cb.blocker_id = b.id
                      AND cb.blocked_type = 'creator' AND cb.blocked_id = $1) AS blocked_me,
           -- Item 8 (E1): the date her cooldown with this brand lifts, so T1 can
           -- say when instead of only that she cannot. A block still masks it,
           -- which is why this is read below NOT_ACCEPTING, never above it.
           (SELECT pc.cooldown_until FROM proposal_cooldowns pc
             WHERE pc.influencer_id = $1 AND pc.brand_id = b.id AND pc.cooldown_until > now()) AS cooldown_until,
           EXISTS (SELECT 1 FROM contracts con
                     JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
                     JOIN campaign_sets cs ON cs.id = ci.set_id
                     JOIN campaigns c ON c.id = cs.campaign_id
                    WHERE ci.influencer_id = $1 AND c.brand_id = b.id AND ${SIGNED_CONTRACT_SQL}) AS signed_before
      FROM brands b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN brand_pitch_settings ps ON ps.brand_id = b.id
     WHERE u.status = 'approved' AND u.role = 'brand'
  ),
  scored AS (
    SELECT b.*,
           CASE WHEN NOT b.accepting OR b.blocked_me THEN 'NOT_ACCEPTING'
                WHEN b.cooldown_until IS NOT NULL THEN 'COOLDOWN'
                WHEN b.allow_past AND b.signed_before THEN 'OK'
                WHEN b.niche_codes IS NOT NULL AND cardinality(b.niche_codes) > 0
                     AND NOT (COALESCE(me.niche, '{}'::varchar[])::text[] && b.niche_codes) THEN 'NOT_MATCHING'
                WHEN (b.min_followers_instagram IS NOT NULL OR b.min_followers_youtube IS NOT NULL)
                     AND NOT ((b.min_followers_instagram IS NOT NULL AND me.ig >= b.min_followers_instagram)
                           OR (b.min_followers_youtube   IS NOT NULL AND me.yt >= b.min_followers_youtube))
                  THEN CASE WHEN (b.min_followers_instagram IS NOT NULL AND NOT me.ig_measured)
                              OR (b.min_followers_youtube   IS NOT NULL AND NOT me.yt_measured)
                            THEN 'BEING_MEASURED' ELSE 'NOT_MATCHING' END
                WHEN b.min_engagement_rate IS NOT NULL AND me.er < b.min_engagement_rate
                  THEN CASE WHEN me.er_measured THEN 'NOT_MATCHING' ELSE 'BEING_MEASURED' END
                WHEN b.language_codes IS NOT NULL AND cardinality(b.language_codes) > 0
                     AND NOT (COALESCE(me.language, '{}'::varchar[])::text[] && b.language_codes) THEN 'NOT_MATCHING'
                WHEN b.city_ids IS NOT NULL AND cardinality(b.city_ids) > 0
                     AND (me.city_id IS NULL OR NOT (me.city_id = ANY(b.city_ids))) THEN 'NOT_MATCHING'
                ELSE 'OK' END AS status
      FROM base b CROSS JOIN me
  )`;

/** Map<brandId, status> for many brands in one query. */
async function statusForBrands(influencerId, brandIds) {
  const ids = [...new Set((brandIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { rows } = await db.query(
    `WITH ${BRAND_BASE_CTE} SELECT id, status FROM scored WHERE id = ANY($2::uuid[])`,
    [influencerId, ids]
  );
  return new Map(rows.map(r => [r.id, r.status]));
}

async function findBrands(influencerId, q = {}) {
  const params = [influencerId];
  const where = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };

  const canPitchOnly = q.canPitchOnly === undefined ? true : !(q.canPitchOnly === false || q.canPitchOnly === 'false' || q.canPitchOnly === '0' || q.canPitchOnly === 0);
  if (canPitchOnly) where.push(`s.status = 'OK'`);
  const search = clean(q.search);
  if (search) where.push(`lower(s.name) LIKE ${p(`%${String(search).trim().toLowerCase()}%`)}`);
  const cats = arr(q.categoryCodes);
  if (cats && cats.length) where.push(`s.sub_categories::text[] && ${p(cats)}::text[]`);
  const cityIds = arr(q.cityIds);
  if (cityIds && cityIds.length) {
    where.push(`EXISTS (SELECT 1 FROM brand_branches bb WHERE bb.brand_id = s.id AND bb.city_id = ANY(${p(cityIds.map(Number).filter(Number.isFinite))}::int[]))`);
  }
  const aims = arr(q.aims);
  if (aims && aims.length) where.push(`s.aims::text[] && ${p(aims)}::text[]`);
  const modes = arr(q.modes);
  if (modes && modes.length) where.push(`s.modes::text[] && ${p(modes)}::text[]`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: cnt } = await db.query(`WITH ${BRAND_BASE_CTE} SELECT count(*)::int AS n FROM scored s ${whereSql}`, params);
  const total = cnt[0].n;
  if (q.countOnly === true || q.countOnly === '1' || q.countOnly === 'true') return { total };

  const sort = q.sort === 'az' ? 'lower(s.name) ASC'
    : q.sort === 'products' ? 's.product_count DESC, lower(s.name) ASC'
    : 's.approved_order DESC';
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const off = p((page - 1) * PAGE);
  const lim = p(PAGE);
  const { rows } = await db.query(
    `WITH ${BRAND_BASE_CTE}
     SELECT s.id, s.name, s.logo_url, s.sub_categories, s.main_city, s.product_count, s.aims, s.modes,
            s.status, s.cooldown_until
       FROM scored s ${whereSql} ORDER BY ${sort} LIMIT ${lim} OFFSET ${off}`,
    params
  );
  return {
    total, page,
    rows: rows.map(r => ({
      id: r.id, name: r.name, logoUrl: r.logo_url || null,
      subCategories: Array.isArray(r.sub_categories) ? r.sub_categories : [],
      mainCity: r.main_city || null, productCount: Number(r.product_count || 0),
      acceptedAims: r.aims, acceptedModes: r.modes, status: r.status,
      // Item 8 (T1): a pause with a date on it reads very differently from a
      // refusal. Only ever present when the status IS the cooldown.
      cooldownUntil: r.status === 'COOLDOWN' ? r.cooldown_until : null,
      statusLine: r.status === 'COOLDOWN' ? PITCH_COPY.CREATOR.cooldownLine(r.name, r.cooldown_until)
        : r.status === 'BEING_MEASURED' ? PITCH_COPY.CREATOR.beingMeasured : null,
    })),
  };
}

module.exports = {
  PAGE, CREATOR_BASE_CTE, BRAND_BASE_CTE,
  statusForCreators, statusForBrands, discoverCreators, findBrands, creatorRow, brandSubCategories,
};
