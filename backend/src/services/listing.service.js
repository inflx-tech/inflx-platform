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

function loadSchema(categoryKey) {
  if (!categoryKey) return null;
  const key = categoryKey.toLowerCase().replace(/\s+/g, '_');
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

  // Fetch brand profile
  const { rows: [brand] } = await db.query(
    'SELECT business_name, city, category FROM brands WHERE id = $1',
    [brandId]
  );
  if (!brand) return { score: 0, max: 0, breakdown: [], suggestions: [] };

  // Fetch product count
  const { rows: [{ count: productCount }] } = await db.query(
    'SELECT COUNT(*)::int AS count FROM brand_products WHERE brand_id = $1 AND is_active = true',
    [brandId]
  );

  // Fetch photo count (products with image_url)
  const { rows: [{ count: photoCount }] } = await db.query(
    `SELECT COUNT(*)::int AS count FROM brand_products
     WHERE brand_id = $1 AND is_active = true AND image_url IS NOT NULL AND image_url != ''`,
    [brandId]
  );

  let score = 0;
  let max = 0;
  const breakdown = [];
  const suggestions = [];

  for (const rule of rules) {
    max += rule.points;

    if (rule.field) {
      // Field-based rule — check brand profile has this field (or listing_data future)
      const hasField = brand[rule.field] != null && brand[rule.field] !== '';
      if (hasField) {
        score += rule.points;
        breakdown.push({ label: rule.label, points: rule.points, earned: true });
      } else {
        breakdown.push({ label: rule.label, points: rule.points, earned: false });
        suggestions.push(`Add ${rule.label.toLowerCase()} to earn +${rule.points} points`);
      }
    } else if (rule.items) {
      // Item count rule — check product count meets minimum
      const met = productCount >= (rule.min || 0);
      if (met) {
        score += rule.points;
        breakdown.push({ label: rule.label, points: rule.points, earned: true });
      } else {
        breakdown.push({ label: rule.label, points: rule.points, earned: false });
        suggestions.push(`Add ${(rule.min || 0) - productCount} more ${rule.items === 'menu_item' ? 'menu items' : 'products'} to earn +${rule.points} points`);
      }
    } else if (rule.type === 'photos') {
      const met = photoCount >= (rule.min || 0);
      if (met) {
        score += rule.points;
        breakdown.push({ label: rule.label, points: rule.points, earned: true });
      } else {
        breakdown.push({ label: rule.label, points: rule.points, earned: false });
        suggestions.push(`Upload ${(rule.min || 0) - photoCount} more photos to earn +${rule.points} points`);
      }
    }
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
