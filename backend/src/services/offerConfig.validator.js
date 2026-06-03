'use strict';

/**
 * offerConfig.validator.js — single source of truth for "is this a well-formed
 * brand offer?", shared by the offer-library CRUD (Sub-contract A) and, later,
 * the campaign-wizard attach path (Sub-contract C).
 *
 * Validates:
 *   1. offer_type ∈ the canonical library vocabulary
 *   2. the per-type offer_config_json shape (mirrors the shapes
 *      offer.service.js resolveOfferDiscount consumes)
 *   3. every referenced product belongs to the brand (catalogue ownership)
 *
 * NOTE: this is the LIBRARY vocabulary (discount/volume/bogo/bundle/free_gift).
 * The legacy campaign path (campaign.controller VALID_OFFER_TYPES =
 * flat/percentage/bogo/bundle/volume/prebook) is intentionally NOT routed
 * through this in Sub-contract A — bridging the two vocabularies is C's job.
 *
 * Returns a plain result object (never throws): { ok: true } or
 * { ok: false, field, message }. The caller maps a falsy result to a
 * 422 VALIDATION_ERROR.
 */

const VALID_OFFER_TYPES = ['discount', 'volume', 'bogo', 'bundle', 'free_gift'];
const VALID_AVAILING_MODES = ['pay_at_store', 'online_order', 'prebook', 'enquiry'];
const VALID_SCOPES = ['store', 'category', 'products'];

const fail = (field, message) => ({ ok: false, field, message });
const OK = { ok: true };

function isPositiveNumber(v) {
  return v != null && Number.isFinite(Number(v)) && Number(v) > 0;
}

function productIdOf(p) {
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p.id || p.product_id || null;
}

/** Collect every product id referenced anywhere in a config (for ownership). */
function collectProductIds(offerType, cfg) {
  const ids = [];
  const push = (p) => { const id = productIdOf(p); if (id) ids.push(id); };
  switch (offerType) {
    case 'discount':
    case 'volume':
      (cfg.products || []).forEach(push);
      break;
    case 'bogo':
      push(cfg.buy_product); push(cfg.get_product);
      break;
    case 'bundle':
      (cfg.products || []).forEach(push);
      break;
    case 'free_gift':
      (cfg.offers || []).forEach(o => { push(o?.main); push(o?.gift); });
      break;
    default:
      break;
  }
  return [...new Set(ids)];
}

/** Shape check per type. `f` prefixes the field path for error reporting. */
function validateShape(offerType, cfg) {
  if (cfg == null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return fail('offer_config_json', 'offer_config_json must be an object');
  }

  // Scope is shared by discount + volume.
  const scopeCheck = () => {
    const scope = cfg.scope || (Array.isArray(cfg.products) && cfg.products.length ? 'products' : 'store');
    if (!VALID_SCOPES.includes(scope)) {
      return fail('offer_config_json.scope', `scope must be one of: ${VALID_SCOPES.join(', ')}`);
    }
    if (scope === 'category' && !cfg.category) {
      return fail('offer_config_json.category', 'category is required when scope is "category"');
    }
    if (scope === 'products' && !(Array.isArray(cfg.products) && cfg.products.length > 0)) {
      return fail('offer_config_json.products', 'at least one product is required when scope is "products"');
    }
    return null;
  };

  switch (offerType) {
    case 'discount': {
      if (cfg.sub_type !== 'pct' && cfg.sub_type !== 'flat') {
        return fail('offer_config_json.sub_type', 'sub_type must be "pct" or "flat"');
      }
      if (!isPositiveNumber(cfg.value)) {
        return fail('offer_config_json.value', 'value must be a positive number');
      }
      if (cfg.sub_type === 'pct' && Number(cfg.value) > 100) {
        return fail('offer_config_json.value', 'percentage value cannot exceed 100');
      }
      return scopeCheck() || OK;
    }
    case 'volume': {
      if (!Array.isArray(cfg.tiers) || cfg.tiers.length === 0) {
        return fail('offer_config_json.tiers', 'at least one volume tier is required');
      }
      for (let i = 0; i < cfg.tiers.length; i += 1) {
        const t = cfg.tiers[i];
        if (!isPositiveNumber(t?.min_spend)) {
          return fail(`offer_config_json.tiers[${i}].min_spend`, 'min_spend must be a positive number');
        }
        if (!isPositiveNumber(t?.pct_off) || Number(t.pct_off) > 100) {
          return fail(`offer_config_json.tiers[${i}].pct_off`, 'pct_off must be a positive number up to 100');
        }
      }
      return scopeCheck() || OK;
    }
    case 'bogo': {
      if (!productIdOf(cfg.buy_product)) {
        return fail('offer_config_json.buy_product', 'buy_product (with an id) is required');
      }
      if (!productIdOf(cfg.get_product)) {
        return fail('offer_config_json.get_product', 'get_product (with an id) is required');
      }
      return OK;
    }
    case 'bundle': {
      const ids = (cfg.products || []).map(productIdOf).filter(Boolean);
      if (ids.length < 2) {
        return fail('offer_config_json.products', 'a bundle needs at least 2 products');
      }
      if (!isPositiveNumber(cfg.bundle_price)) {
        return fail('offer_config_json.bundle_price', 'bundle_price must be a positive number');
      }
      return OK;
    }
    case 'free_gift': {
      if (!Array.isArray(cfg.offers) || cfg.offers.length === 0) {
        return fail('offer_config_json.offers', 'at least one main→gift pairing is required');
      }
      for (let i = 0; i < cfg.offers.length; i += 1) {
        const o = cfg.offers[i];
        if (!productIdOf(o?.main)) {
          return fail(`offer_config_json.offers[${i}].main`, 'main product (with an id) is required');
        }
        if (!productIdOf(o?.gift)) {
          return fail(`offer_config_json.offers[${i}].gift`, 'gift product (with an id) is required');
        }
      }
      return OK;
    }
    default:
      return fail('offer_type', `offer_type must be one of: ${VALID_OFFER_TYPES.join(', ')}`);
  }
}

/**
 * Validate offer_type ∈ vocab, offer_config_json shape, and product ownership.
 *
 * @param {object}   p
 * @param {string}   p.offerType
 * @param {object}   p.offerConfig
 * @param {string}   p.brandId
 * @param {object}   p.db          db module with .query(text, params)
 * @returns {Promise<{ok:true} | {ok:false, field, message}>}
 */
async function validateOfferConfig({ offerType, offerConfig, brandId, db }) {
  if (!offerType || !VALID_OFFER_TYPES.includes(offerType)) {
    return fail('offer_type', `offer_type must be one of: ${VALID_OFFER_TYPES.join(', ')}`);
  }
  const shape = validateShape(offerType, offerConfig);
  if (!shape.ok) return shape;

  // Catalogue ownership: every referenced product must belong to this brand.
  const ids = collectProductIds(offerType, offerConfig);
  if (ids.length > 0) {
    const { rows } = await db.query(
      `SELECT id FROM brand_products WHERE id = ANY($1::uuid[]) AND brand_id = $2`,
      [ids, brandId]
    );
    const owned = new Set(rows.map(r => r.id));
    const foreign = ids.find(id => !owned.has(id));
    if (foreign) {
      return fail('offer_config_json.products', 'referenced product is not owned by this brand');
    }
  }
  return OK;
}

/** Validate the availing_modes array (optional; defaulted at the DB level). */
function validateAvailingModes(modes) {
  if (modes == null) return OK;
  if (!Array.isArray(modes) || modes.length === 0) {
    return fail('availing_modes', 'availing_modes must be a non-empty array');
  }
  const bad = modes.find(m => !VALID_AVAILING_MODES.includes(m));
  if (bad) {
    return fail('availing_modes', `availing_modes must be a subset of: ${VALID_AVAILING_MODES.join(', ')}`);
  }
  return OK;
}

module.exports = {
  validateOfferConfig,
  validateAvailingModes,
  collectProductIds,
  VALID_OFFER_TYPES,
  VALID_AVAILING_MODES,
  VALID_SCOPES,
};
