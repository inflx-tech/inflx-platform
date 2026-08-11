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
 * NOTE: this is the LIBRARY vocabulary (discount/volume/bogo/bundle/free_gift)
 * and — since collab-part1-corrections — the ONLY vocabulary. The bridge the
 * original header called "C's job" is `normalizeOfferType` below: the web
 * wizard used to write display labels ('Discount', 'Volume discount', …) and
 * the mobile brand invite used to write 'flat'/'percentage', all into the same
 * unconstrained campaign_influencers.offer_type column. Both apps now send
 * canonical keys; the normaliser stays as the read-side safety net for rows
 * written before migration 145.
 *
 * Validates:
 *   4. every referenced product is pushed to the store — an offer must not
 *      cover items no customer can see (collab-part1-corrections §1.1).
 *      `is_active` is deliberately NOT enforced here: the founder defined
 *      publish as push-to-store only, so folding in a second flag would be
 *      scope we were not asked for.
 *
 * Returns a plain result object (never throws): { ok: true } or
 * { ok: false, field, message }. The caller maps a falsy result to a
 * 422 VALIDATION_ERROR.
 */

const VALID_OFFER_TYPES = ['discount', 'volume', 'bogo', 'bundle', 'free_gift'];

/**
 * Legacy → canonical offer-type map. Keys are lowercased on lookup.
 *
 * 'flat' and 'percentage' both collapse to 'discount' because they were never
 * separate mechanics — the flat-vs-percent distinction lives in the config as
 * sub_type, which is what the web wizard has always stored.
 *
 * 'prebook' is intentionally absent. It appears in the legacy campaign enum but
 * is an availing MODE, not an offer mechanic, and no current writer puts it in
 * this column. Mapping it to a discount would invent a discount that never
 * existed, so unknown values pass through unchanged and get rejected at write
 * time instead.
 */
const LEGACY_OFFER_TYPE_MAP = {
  'discount':         'discount',
  'flat':             'discount',
  'percentage':       'discount',
  'volume discount':  'volume',
  'volume_discount':  'volume',
  'volume':           'volume',
  'bogo':             'bogo',
  'bundle':           'bundle',
  'free gift':        'free_gift',
  'free_gift':        'free_gift',
};

/**
 * Map any historical offer-type spelling to the canonical vocabulary.
 * Unrecognised input is returned lowercased-and-trimmed but otherwise
 * unchanged, so read paths still match rather than silently resolving to null.
 * Returns null only for null/empty input.
 */
function normalizeOfferType(raw) {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  return LEGACY_OFFER_TYPE_MAP[key] || key;
}

/**
 * Recover the discount sub_type an older client didn't send.
 *
 * The pre-canonical mobile build posted offer_type 'flat' | 'percentage' with a
 * config of just { value }. Both normalise to 'discount', whose config REQUIRES
 * sub_type — so once the campaign path started validating, those payloads would
 * 422 until every phone took the OTA. The legacy type already carries the
 * information, so infer it rather than rejecting a request we can understand.
 *
 * This is deliberately the same rule migration 147 applies to stored rows, so a
 * collab created by an old build during the OTA gap ends up identical to one the
 * migration converted.
 *
 * Returns the config unchanged unless it is a discount that is missing sub_type
 * AND the raw type tells us which kind it was.
 */
function backfillDiscountSubType(rawOfferType, config) {
  if (normalizeOfferType(rawOfferType) !== 'discount') return config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  if (config.sub_type === 'pct' || config.sub_type === 'flat') return config;

  const raw = String(rawOfferType || '').trim().toLowerCase();
  if (raw !== 'flat' && raw !== 'percentage') return config;   // can't infer — let it fail honestly
  return { ...config, sub_type: raw === 'percentage' ? 'pct' : 'flat' };
}
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
      // NEW same-product shape (product) + OLD (buy_product/get_product).
      push(cfg.product); push(cfg.buy_product); push(cfg.get_product);
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
    if (scope === 'category' && !cfg.category && !cfg.category_node_id) {
      return fail('offer_config_json.category', 'category or category_node_id is required when scope is "category"');
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
      // mode: 'quantity' tiers gate on min_qty (buy N units); default 'spend'
      // tiers gate on min_spend (₹). (Phase 3 — offer-new-shapes.)
      const quantity = cfg.mode === 'quantity';
      for (let i = 0; i < cfg.tiers.length; i += 1) {
        const t = cfg.tiers[i];
        if (quantity) {
          if (!isPositiveNumber(t?.min_qty)) {
            return fail(`offer_config_json.tiers[${i}].min_qty`, 'min_qty must be a positive number');
          }
        } else if (!isPositiveNumber(t?.min_spend)) {
          return fail(`offer_config_json.tiers[${i}].min_spend`, 'min_spend must be a positive number');
        }
        if (!isPositiveNumber(t?.pct_off) || Number(t.pct_off) > 100) {
          return fail(`offer_config_json.tiers[${i}].pct_off`, 'pct_off must be a positive number up to 100');
        }
      }
      return scopeCheck() || OK;
    }
    case 'bogo': {
      // NEW same-product BOGO (Phase 3): buy N of a product → M of the SAME
      // product free. Presence of `product` (or a qty field) selects it.
      if (cfg.product || cfg.buy_qty != null || cfg.free_qty != null) {
        if (!productIdOf(cfg.product)) {
          return fail('offer_config_json.product', 'product (with an id) is required');
        }
        if (cfg.buy_qty != null && !isPositiveNumber(cfg.buy_qty)) {
          return fail('offer_config_json.buy_qty', 'buy_qty must be a positive number');
        }
        if (cfg.free_qty != null && !isPositiveNumber(cfg.free_qty)) {
          return fail('offer_config_json.free_qty', 'free_qty must be a positive number');
        }
        return OK;
      }
      // OLD shape (buy_product + get_product) — left valid for existing offers.
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
  // Publish rule (collab-part1-corrections §1.1): and must be pushed to the
  // store, so an offer can never cover an item no customer can see.
  const ids = collectProductIds(offerType, offerConfig);
  if (ids.length > 0) {
    const { rows } = await db.query(
      `SELECT id, name, pushed_to_store
         FROM brand_products WHERE id = ANY($1::uuid[]) AND brand_id = $2`,
      [ids, brandId]
    );
    const owned = new Map(rows.map(r => [r.id, r]));
    const foreign = ids.find(id => !owned.has(id));
    if (foreign) {
      return fail('offer_config_json.products', 'referenced product is not owned by this brand');
    }
    const unpublished = ids
      .map(id => owned.get(id))
      .filter(p => p && p.pushed_to_store === false);
    if (unpublished.length > 0) {
      const names = unpublished.map(p => p.name || p.id).join(', ');
      return fail(
        'offer_config_json.products',
        `an offer cannot include products that are not published to your store: ${names}. ` +
        `Publish them first, or remove them from this offer.`
      );
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
  normalizeOfferType,
  backfillDiscountSubType,
  LEGACY_OFFER_TYPE_MAP,
  VALID_OFFER_TYPES,
  VALID_AVAILING_MODES,
  VALID_SCOPES,
};
