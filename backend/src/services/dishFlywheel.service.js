'use strict';

/**
 * dishFlywheel.service.js
 *
 * Contract: features/listing-restaurant-search-flywheel.
 *
 * The custom-name flywheel for the restaurant dish dictionary:
 *  - fuzzy search of master_dishes (+ aliases) via pg_trgm/unaccent
 *  - capture of seller-typed custom names into pending_dishes (goes live
 *    regardless; never blocks the listing)
 *  - a PURE promotion-candidate detector (unit-tested, no DB)
 *
 * Migration 087 installs pg_trgm + unaccent and creates dish_aliases +
 * pending_dishes. All queries here assume those exist; callers degrade
 * gracefully (search falls back, capture is best-effort).
 */

const SUGGEST_CUTOFF = 0.30;   // locked: show a suggestion only at sim >= 0.30
const PROMOTE_THRESHOLD = 5;   // locked: flag (not auto-write) at >= 5 restaurants

/**
 * Normalize a raw dish name for grouping/dedupe:
 * lowercase, strip accents, collapse whitespace, trim.
 * Mirrors the DB-side unaccent(lower(trim())) used for matching.
 */
function normalizeName(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy-search the canonical dictionary (+ aliases) for a typed query.
 * Returns rows { id, name, section, cuisine, popularity_rank, score,
 * is_activated } ranked by similarity then popularity, cut at SUGGEST_CUTOFF.
 */
async function searchMasterDishes(db, q, brandId, limit = 8) {
  const { rows } = await db.query(
    `WITH scored AS (
       SELECT md.id, md.name, md.section, md.cuisine, md.popularity_rank,
              GREATEST(
                similarity(unaccent(lower(md.name)), unaccent(lower($1))),
                COALESCE((
                  SELECT MAX(similarity(unaccent(lower(da.alias_text)), unaccent(lower($1))))
                  FROM dish_aliases da WHERE da.master_dish_id = md.id
                ), 0)
              ) AS score
       FROM master_dishes md
     )
     SELECT s.id, s.name, s.section, s.cuisine, s.popularity_rank, s.score,
            (bp.id IS NOT NULL) AS is_activated
     FROM scored s
     LEFT JOIN brand_products bp
       ON bp.master_dish_id = s.id AND bp.brand_id = $2 AND bp.is_active = true
     WHERE s.score >= $3
     ORDER BY s.score DESC, s.popularity_rank DESC, s.name
     LIMIT $4`,
    [q, brandId, SUGGEST_CUTOFF, limit]
  );
  const canonical = rows.map(r => ({ ...r, score: Number(r.score), is_custom: false }));

  // FLYWHEEL AUTO-SURFACE: also suggest custom dishes that OTHER restaurants
  // have typed (pending_dishes, status='pending'), grouped by normalized name
  // so each shows once with a restaurant count. Excludes names that already
  // exist canonically (admin promotion consolidates those). Best-effort: a
  // failure here must never break the canonical typeahead.
  let customs = [];
  try {
    const { rows: cr } = await db.query(
      `SELECT pd.norm_name,
              (array_agg(pd.raw_name ORDER BY pd.created_at))[1] AS name,
              (array_agg(pd.section ORDER BY pd.created_at))[1]  AS section,
              COUNT(DISTINCT pd.brand_id)::int AS restaurant_count,
              similarity(pd.norm_name, unaccent(lower($1))) AS score
         FROM pending_dishes pd
        WHERE pd.status = 'pending'
        GROUP BY pd.norm_name
       HAVING similarity(pd.norm_name, unaccent(lower($1))) >= $2
          AND NOT EXISTS (
              SELECT 1 FROM master_dishes md
               WHERE unaccent(lower(md.name)) = pd.norm_name)
        ORDER BY score DESC, restaurant_count DESC
        LIMIT $3`,
      [q, SUGGEST_CUTOFF, limit]
    );
    customs = cr.map(r => ({
      id: null, name: r.name, section: r.section, cuisine: null,
      popularity_rank: null, score: Number(r.score), is_activated: false,
      is_custom: true, restaurant_count: r.restaurant_count, norm_name: r.norm_name,
    }));
  } catch { customs = []; }

  // Merge canonical-first; drop customs whose normalized name a canonical hit
  // already covers; rank by score; cap.
  const canonNorms = new Set(canonical.map(c => normalizeName(c.name)));
  const merged = canonical.concat(customs.filter(c => !canonNorms.has(c.norm_name)));
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit);
}

/** Best single canonical match for a name (used when capturing a custom dish). */
async function findBestMatch(db, name) {
  const { rows } = await db.query(
    `SELECT md.id,
            similarity(unaccent(lower(md.name)), unaccent(lower($1))) AS score
     FROM master_dishes md
     ORDER BY score DESC
     LIMIT 1`,
    [name]
  );
  if (!rows[0] || Number(rows[0].score) < SUGGEST_CUTOFF) return null;
  return { master_dish_id: rows[0].id, score: Number(rows[0].score) };
}

/**
 * Capture a seller-typed custom dish into pending_dishes. Best-effort:
 * the caller must NOT let a failure here block the listing going live.
 * Dedupes per brand_product via the unique index (ON CONFLICT DO NOTHING).
 */
async function capturePendingDish(db, { brand_id, brand_product_id, raw_name, section }) {
  const norm = normalizeName(raw_name);
  if (!norm) return;
  const best = await findBestMatch(db, raw_name);
  await db.query(
    `INSERT INTO pending_dishes
       (brand_id, brand_product_id, raw_name, norm_name, section,
        suggested_master_dish_id, suggested_score, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
     ON CONFLICT (brand_product_id) WHERE brand_product_id IS NOT NULL DO NOTHING`,
    [brand_id, brand_product_id, raw_name, norm, section || null,
     best ? best.master_dish_id : null, best ? best.score : null]
  );
}

/**
 * PURE: given pending rows [{ norm_name, brand_id, suggested_master_dish_id }],
 * return groups seen at >= threshold DISTINCT restaurants with NO confident
 * canonical match — the auto-promote candidates the flywheel surfaces.
 * No DB, no network — unit-tested directly.
 */
function findPromotionCandidates(rows, threshold = PROMOTE_THRESHOLD) {
  const groups = new Map();
  for (const r of rows || []) {
    const key = r.norm_name;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name: key, brands: new Set(), matched: false });
    const g = groups.get(key);
    g.brands.add(r.brand_id);
    if (r.suggested_master_dish_id != null) g.matched = true;
  }
  return [...groups.values()]
    .filter(g => !g.matched && g.brands.size >= threshold)
    .map(g => ({ name: g.name, count: g.brands.size }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  SUGGEST_CUTOFF,
  PROMOTE_THRESHOLD,
  normalizeName,
  searchMasterDishes,
  findBestMatch,
  capturePendingDish,
  findPromotionCandidates,
};
