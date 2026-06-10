'use strict';

const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// Listing Engine Service
// Centralised config loader, quality score calculator, and phase gating.
// ─────────────────────────────────────────────────────────────────────────────

const LISTING_ENGINE_PHASE = parseInt(process.env.LISTING_ENGINE_PHASE || '1', 10);

// ── Schema cache (shared with brand.controller — migrating here) ─────────

const schemaCache = new Map();

// Legacy fashion sub-variants → unified `fashion` schema (see schema.service.js).
const SCHEMA_ALIASES = { fashion_walkin: 'fashion', fashion_online: 'fashion' };

function loadSchema(categoryKey) {
  if (!categoryKey) return null;
  let key = categoryKey.toLowerCase().replace(/\s+/g, '_');
  key = SCHEMA_ALIASES[key] || key;
  if (schemaCache.has(key)) return schemaCache.get(key);

  const filePath = path.join(__dirname, '../../public/schemas', `${key}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(raw);
    schemaCache.set(key, schema);
    return schema;
  } catch {
    return null;
  }
}

/** Clear cache (for tests) */
function clearSchemaCache() {
  schemaCache.clear();
}

// ── Config accessors ─────────────────────────────────────────────────────

function getConfigForCategory(categoryKey) {
  return loadSchema(categoryKey);
}

/**
 * Returns the brand's schema with dynamic options sourced from master
 * tables merged in. For restaurant: brand_config.fields.cuisines.options
 * gets union'd with distinct cuisines from master_dishes (admin-authored
 * content via the admin master-dishes CRUD). This closes the autosync
 * gap — admin can add a new cuisine + seed dishes for it, and brands
 * see it in the wizard's step 1 cuisine multi-select on the very next
 * /brands/me/listing-config request.
 *
 * Other categories pass through unchanged. Defensive: DB query failure
 * falls back to the declared static list so the wizard still works.
 *
 * No cache mutation — returns a shallow copy with the merged options.
 * The base schemaCache holds the on-disk file, untouched.
 *
 * Order: declared cuisines first (curated taxonomy from restaurant.json),
 * admin-added cuisines append at the end. Declared cuisines that have no
 * dishes seeded yet are preserved (per phase-1 decision: brands picking
 * an unseeded cuisine see the "no dishes available yet" empty state in
 * the picker, with a Bulk Upload fallback).
 *
 * Casing: matched verbatim. Admin-added "south indian" and declared
 * "South Indian" coexist as distinct entries. Admin's responsibility to
 * keep casing consistent.
 */
async function getAugmentedConfigForBrand(brand) {
  const baseSchema = loadSchema(brand?.category);
  if (!baseSchema) return null;

  if (brand.category === 'restaurant') {
    return await augmentRestaurantCuisines(baseSchema);
  }
  return baseSchema;
}

async function augmentRestaurantCuisines(schema) {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT cuisine FROM master_dishes
       WHERE cuisine IS NOT NULL AND cuisine != ''
       ORDER BY cuisine`
    );
    const masterCuisines = rows.map(r => r.cuisine);
    const declared = schema.brand_config?.fields?.cuisines?.options || [];

    const declaredSet = new Set(declared);
    const merged = [...declared];
    for (const c of masterCuisines) {
      if (!declaredSet.has(c)) merged.push(c);
    }

    // No mutation — the base schema in schemaCache stays as the on-disk file.
    return {
      ...schema,
      brand_config: {
        ...schema.brand_config,
        fields: {
          ...schema.brand_config.fields,
          cuisines: {
            ...schema.brand_config.fields.cuisines,
            options: merged,
          },
        },
      },
    };
  } catch (e) {
    console.warn('[listing.service] master_dishes cuisine augmentation failed, falling back to declared options:', e.message);
    return schema;
  }
}

function getListingSteps(categoryKey) {
  const schema = loadSchema(categoryKey);
  return schema?.listing_steps || [];
}

function getCardConfig(categoryKey) {
  const schema = loadSchema(categoryKey);
  return schema?.card_config || null;
}

function getActionTypes(categoryKey) {
  const schema = loadSchema(categoryKey);
  return schema?.action_types || {};
}

function getQualityRules(categoryKey) {
  const schema = loadSchema(categoryKey);
  return schema?.quality_rules || [];
}

// ── Phase gating ─────────────────────────────────────────────────────────

function getActivePhaseCategories() {
  const schemasDir = path.join(__dirname, '../../public/schemas');
  const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));

  const active = [];
  for (const file of files) {
    const schema = loadSchema(file.replace('.json', ''));
    if (schema && schema.phase <= LISTING_ENGINE_PHASE && schema.status === 'active') {
      active.push({
        category_key: schema.category_key,
        label: schema.label,
        icon: schema.icon,
        super_category: schema.super_category || null,
      });
    }
  }
  return active;
}

function isCategoryActive(categoryKey) {
  const schema = loadSchema(categoryKey);
  if (!schema) return false;
  return schema.phase <= LISTING_ENGINE_PHASE && schema.status === 'active';
}

// ── Super-categories (for follower Find screen) ──────────────────────────

const SUPER_CATEGORIES = [
  { key: 'eat',     label: 'Eat',      icon: '🍽️', sub_categories: ['restaurant', 'bakery', 'packaged_food', 'grocery'] },
  { key: 'shop',    label: 'Shop',     icon: '🛍️', sub_categories: ['fashion_walkin', 'fashion_online', 'electronics', 'jewellery', 'footwear', 'furniture', 'optical', 'pet_shop', 'flowers_gifting', 'hardware'] },
  { key: 'groom',   label: 'Groom',    icon: '✨',  sub_categories: ['salon', 'home_beauty', 'pet_grooming'] },
  { key: 'fitness', label: 'Stay Fit', icon: '💪',  sub_categories: ['gym_fitness', 'clinic_doctor', 'dental_clinic', 'diagnostic_lab', 'coaching_center'] },
  { key: 'travel',  label: 'Travel',   icon: '✈️', sub_categories: ['travel_packages', 'car_rental', 'bike_rental', 'hotel_homestay'] },
  { key: 'home',    label: 'Home',     icon: '🏠',  sub_categories: ['home_services', 'interior_design', 'pest_control', 'laundry', 'coworking_space'] },
  { key: 'events',  label: 'Events',   icon: '🎉',  sub_categories: ['function_hall', 'wedding_planner', 'florist', 'photography', 'legal_ca'] },
];

function getSuperCategories() {
  return SUPER_CATEGORIES;
}

function getSubCategories(superCategoryKey) {
  const sc = SUPER_CATEGORIES.find(s => s.key === superCategoryKey);
  if (!sc) return [];
  return sc.sub_categories.map(ck => {
    const schema = loadSchema(ck);
    return schema ? {
      category_key: schema.category_key,
      label: schema.label,
      icon: schema.icon,
      phase: schema.phase,
      status: schema.status,
    } : null;
  }).filter(Boolean);
}

// ── Quality score calculator ─────────────────────────────────────────────

async function calculateQualityScore(brandId, categoryKey) {
  const rules = getQualityRules(categoryKey);
  if (!rules.length) return { score: 0, max: 0, breakdown: [], suggestions: [] };

  // Fetch brand profile.
  // Bug fix (2026-06-07, founder dogfood): the wizard writes profile fields
  // (restaurant_description, cuisines, vibes, cost_for_two, google_maps_url,
  // hours_json, cover_image_url, accepts_table_booking, photos[]) into
  // `brands.listing_data` JSONB — NOT typed columns. The scorer previously
  // selected only business_name/city/category, so every brand-scope `field`
  // rule read `undefined` → earned:false → 0/100 even on a fully-filled
  // profile. We now select listing_data and merge it with the few typed
  // identity columns so field-rules resolve wherever the value is stored.
  // city lives on `users` (brands has no city column).
  const { rows: [brand] } = await db.query(
    `SELECT b.business_name, b.listing_data, u.city, b.category
       FROM brands b JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [brandId]
  );
  if (!brand) return { score: 0, max: 0, breakdown: [], suggestions: [] };

  const listingData = brand.listing_data || {};
  const profile = {
    ...listingData,
    business_name: brand.business_name,
    city: brand.city,
    category: brand.category,
  };

  // Brand GALLERY photos live in listing_data.photos[] (distinct from per-dish
  // image_url). `type:photos scope:brand` rules count these.
  const galleryPhotoCount = Array.isArray(listingData.photos) ? listingData.photos.length : 0;

  // Fetch product count
  const { rows: [{ count: productCount }] } = await db.query(
    'SELECT COUNT(*)::int AS count FROM brand_products WHERE brand_id = $1 AND is_active = true',
    [brandId]
  );

  // Fetch DISH photo count (products with their own image_url) — for the
  // `scope:item_photos` rule (% of dishes with a photo).
  const { rows: [{ count: productPhotoCount }] } = await db.query(
    `SELECT COUNT(*)::int AS count FROM brand_products
     WHERE brand_id = $1 AND is_active = true AND image_url IS NOT NULL AND image_url != ''`,
    [brandId]
  );

  const hasValue = (v) =>
    v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

  let score = 0;
  let max = 0;
  const breakdown = [];
  const suggestions = [];

  for (const rule of rules) {
    max += rule.points;
    let earned = false;

    if (rule.type === 'photos') {
      // Brand gallery photos.
      earned = galleryPhotoCount >= (rule.min || 0);
      if (!earned) suggestions.push(`Upload ${Math.max(0, (rule.min || 0) - galleryPhotoCount)} more gallery photos to earn +${rule.points} points`);
    } else if (rule.items) {
      // Menu/product count.
      earned = productCount >= (rule.min || 0);
      if (!earned) suggestions.push(`Add ${Math.max(0, (rule.min || 0) - productCount)} more ${rule.items === 'menu_item' ? 'menu items' : 'menu items'} to earn +${rule.points} points`);
    } else if (rule.scope === 'item_photos' && rule.min_pct != null) {
      // % of dishes that have their own photo.
      const pct = productCount > 0 ? productPhotoCount / productCount : 0;
      earned = productCount > 0 && pct >= rule.min_pct;
      if (!earned) suggestions.push(`Add photos to more dishes (${Math.round(rule.min_pct * 100)}% needed) to earn +${rule.points} points`);
    } else if (rule.field) {
      // Brand-scope profile field — read from the merged listing_data + typed profile.
      earned = hasValue(profile[rule.field]);
      if (!earned) suggestions.push(`Add ${rule.label.toLowerCase()} to earn +${rule.points} points`);
    }

    if (earned) score += rule.points;
    breakdown.push({ label: rule.label, points: rule.points, earned });
  }

  // Normalise to 0-100
  const normalized = max > 0 ? Math.round((score / max) * 100) : 0;

  return { score: normalized, raw_score: score, max, breakdown, suggestions };
}

// ── Update brand listing score (for caching) ─────────────────────────────

async function updateBrandListingScore(brandId, categoryKey) {
  const result = await calculateQualityScore(brandId, categoryKey);
  await db.query(
    'UPDATE brands SET listing_score = $1, listing_score_updated_at = NOW() WHERE id = $2',
    [result.score, brandId]
  );
  return result;
}

module.exports = {
  loadSchema,
  clearSchemaCache,
  getConfigForCategory,
  getAugmentedConfigForBrand,
  getListingSteps,
  getCardConfig,
  getActionTypes,
  getQualityRules,
  getActivePhaseCategories,
  isCategoryActive,
  getSuperCategories,
  getSubCategories,
  calculateQualityScore,
  updateBrandListingScore,
  LISTING_ENGINE_PHASE,
};
