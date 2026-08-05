'use strict';

/**
 * listingBulkActions.service.js — the decision rules behind the two bulk
 * listing actions. Contract: listing-bulk-move-and-offer.
 *
 * Everything here is PURE (no db, no io) so the rules can be unit-tested
 * directly — see qa/unit/listing-bulk-rules.spec.ts. The controllers do the
 * fetching and writing; this file decides what is allowed, and why not.
 *
 * Two questions:
 *   canMoveProduct()       — may this product live under that leaf?
 *   offerAcceptsProducts() — can this offer honour a product attachment at all?
 *
 * Both answer with a REASON on refusal. A bulk action that silently drops rows
 * is worse than one that refuses them out loud.
 *
 * Not to be confused with listingBulk.service.js, which is the Excel importer.
 */

const taxonomy = require('./taxonomy.service');
const { sizeValues } = require('./listingBulk.service');

// Mirrors offer.service.js extractProductIds — a config's product entries are
// either bare id strings or {id|product_id, ...} objects, depending on vintage.
function extractProductIds(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map((p) => (typeof p === 'string' ? p : (p?.id || p?.product_id)))
    .filter(Boolean);
}

// The item shape taxonomy.validateItem expects, rebuilt from a stored row.
// facets carries non-facet keys (brand, _images); validateItem iterates the
// facet DEFS, so extras are ignored rather than tripping validation.
function itemFromProduct(product) {
  return {
    name: product.name,
    price: product.price,
    facets: (product.facets && typeof product.facets === 'object') ? product.facets : {},
  };
}

function sizeValuesOf(product) {
  const f = (product.facets && typeof product.facets === 'object') ? product.facets : {};
  const v = f.size;
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

/**
 * May `product` be moved from `sourceNode` to `targetNode`?
 *
 * targetFacetDefs = the target leaf's facet definitions (taxonomy.getNodeFacets).
 * sourceNode is unused for the decision but kept in the signature because the
 * caller has it and future rules may need it.
 *
 * → { ok: true } | { ok: false, reason: '<human sentence>' }
 */
function canMoveProduct({ product, targetNode, targetFacetDefs }) {
  if (!targetNode) return { ok: false, reason: 'Target category no longer exists.' };
  if (!targetNode.is_leaf) {
    return { ok: false, reason: 'Products can only sit under an item type, not a parent category.' };
  }
  if (product.category_node_id === targetNode.id) {
    return { ok: false, reason: 'Already in this category.' };
  }

  // Size systems are vocabularies (alpha S/M/L vs UK5/UK6 vs age bands). Carrying
  // values across a change of system would leave sizes that mean nothing under
  // the new item type — so check the product's ACTUAL sizes against the target's
  // system rather than assuming a system change is fatal. Moving a Free-Size
  // kurta between two free-size leaves is fine; moving alpha shirts into UK
  // footwear is not.
  const sizes = sizeValuesOf(product);
  if (sizes.length && targetNode.size_system) {
    const allowed = sizeValues(targetNode.size_system);
    const bad = sizes.filter((s) => !allowed.includes(s));
    if (bad.length) {
      return {
        ok: false,
        reason: `${targetNode.name} uses different sizes — ${bad.slice(0, 3).join(', ')} ${bad.length === 1 ? 'is' : 'are'} not valid there. Open the product and re-pick its sizes.`,
      };
    }
  }

  // Same gate create and edit use, so a move can never land a product that the
  // edit form would reject.
  const errors = taxonomy.validateItem(targetNode, targetFacetDefs || [], itemFromProduct(product));
  if (errors.length) return { ok: false, reason: errors.join('; ') };

  return { ok: true };
}

function normalizeType(s) {
  if (!s) return null;
  const t = String(s).toLowerCase().trim();
  if (t === 'volume discount' || t === 'volume_discount') return 'volume';
  if (t === 'free gift') return 'free_gift';
  return t;
}

/**
 * Can this offer take a flat list of products at all?
 *
 * Grounded in offer.service.js, the only thing that reads these configs at
 * checkout:
 *   · discount / volume — scope resolves through offerConfig.products  ✓
 *   · bundle           — products IS the bundle set; every entry must be in the
 *                        cart for it to fire, so adding unrelated products
 *                        breaks it
 *   · bogo / free_gift — pair shapes (buy/get, main/gift), not a list
 * and on resolveScope(): an offer explicitly scoped 'store' or 'category'
 * IGNORES its products array, so attaching there would be a silent no-op.
 *
 * → { ok: true } | { ok: false, reason }
 */
function offerAcceptsProducts(offer) {
  const type = normalizeType(offer?.offer_type);
  if (type !== 'discount' && type !== 'volume') {
    const label = {
      bundle: 'Bundle offers work on one fixed set of products — edit the bundle itself.',
      bogo: 'BOGO offers need a specific buy-and-get pair, not a product list.',
      free_gift: 'Free-gift offers pair each product with its gift, not a product list.',
    }[type];
    return { ok: false, reason: label || 'This offer type does not take a product list.' };
  }

  const config = offer?.offer_config_json || {};
  const scope = config.scope;
  if (scope && scope !== 'products') {
    return {
      ok: false,
      reason: scope === 'category'
        ? 'This offer applies to a whole category — attaching products would have no effect.'
        : 'This offer applies to your whole store — attaching products would have no effect.',
    };
  }
  // Legacy configs carry no `scope`. resolveScope() then INFERS it from the
  // products array: empty means store-wide. Attaching to such an offer would
  // silently narrow it from the whole store down to a handful of products — a
  // real reduction in what customers get. Refuse, and make the brand set the
  // scope deliberately in the offer builder.
  if (!scope && extractProductIds(config.products).length === 0) {
    return {
      ok: false,
      reason: 'This offer currently applies store-wide. Set its scope to specific products in the offer builder first.',
    };
  }
  return { ok: true };
}

/**
 * Merge products into an offer config's product list, deduped by id.
 * Every other key on the config is passed through untouched — attaching must
 * never disturb the offer's value, tiers or availing modes.
 *
 * → { config, added: [id], already: [id] }
 */
function mergeOfferProducts(offerConfig, products) {
  const config = { ...(offerConfig || {}) };
  const existing = Array.isArray(config.products) ? [...config.products] : [];
  const have = new Set(extractProductIds(existing));

  const added = [];
  const already = [];
  for (const p of (products || [])) {
    if (have.has(p.id)) { already.push(p.id); continue; }
    have.add(p.id);
    const entry = { id: p.id, name: p.name };
    if (p.price != null) entry.price = Number(p.price);
    existing.push(entry);
    added.push(p.id);
  }
  config.products = existing;
  return { config, added, already };
}

module.exports = {
  canMoveProduct,
  offerAcceptsProducts,
  mergeOfferProducts,
  _internals: { extractProductIds, itemFromProduct, sizeValuesOf, normalizeType },
};
