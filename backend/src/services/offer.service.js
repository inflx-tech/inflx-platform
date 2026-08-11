'use strict';

/**
 * offer.service.js — single source of truth for "given an offer + customer's
 * cart, what's the discount?"
 *
 * The brand-side campaign wizard (campaigns/[id]/page.js) lets brands attach
 * one of 5 offer types per influencer, stored on
 * campaign_influencers.offer_type + campaign_influencers.offer_config_json.
 * The shapes (per the wizard's buildOfferConfig):
 *
 *   'discount'          { sub_type: 'pct'|'flat', value, products: [...] }
 *   'volume' / 'volume discount'
 *                       { tiers: [{min_spend, pct_off}], products: [...] }
 *   'bogo'              { buy_product, get_product }                       (each is a {id, name, price?})
 *   'bundle'            { products: [{id, name, price?}], bundle_price }
 *   'free gift' / 'free_gift'
 *                       { offers: [{main, gift}] }
 *
 * Until this helper, the transaction layer only honored 'discount' (pct)
 * and silently treated all others as a percentage equal to the raw `value`
 * field — which doesn't exist on Volume/BOGO/Bundle/Free gift configs and
 * fell through to commission_pct (the bug surfaced in the Tier-1 audit).
 *
 * Public API:
 *   resolveOfferDiscount({
 *     offerType,                    // raw string from campaign_influencers.offer_type
 *     offerConfig,                  // parsed offer_config_json
 *     items,                        // [{ product_id, variant_id?, quantity }]
 *     priceMap,                     // Map<product_id, base price (rupees)>
 *     variantPriceMap?,             // Map<variant_id, override price (rupees)> — fashion only
 *     billAmount?,                  // for pay-at-store with no items: the bill total
 *   }) → {
 *     discount_amount,              // rupees off
 *     applied_to: 'cart_total' | 'bill_amount' | 'scope_subtotal',
 *     reason,                       // human-readable description
 *     adjustments: [...],           // optional per-item or bundle/bogo notes
 *   }
 *
 * If an offer doesn't apply to the current cart (e.g. volume threshold not
 * met, BOGO buy-product missing, bundle products incomplete), returns
 * discount_amount=0 with a `reason` explaining why. NEVER throws — the
 * transaction layer should always be able to compute SOMETHING.
 *
 * Variant pricing: when a cart item has variant_id and variantPriceMap has
 * a non-null override, that price wins over the base. Used everywhere
 * itemsTotal is computed.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function lineItemPrice(item, priceMap, variantPriceMap) {
  if (item.variant_id && variantPriceMap && variantPriceMap.get(item.variant_id) != null) {
    return Number(variantPriceMap.get(item.variant_id));
  }
  return Number(priceMap.get(item.product_id) || 0);
}

function itemsTotal(items, priceMap, variantPriceMap) {
  return items.reduce((sum, i) => sum + lineItemPrice(i, priceMap, variantPriceMap) * Number(i.quantity || 1), 0);
}

function r2(n) { return parseFloat((Number(n) || 0).toFixed(2)); }

// collab-part1-corrections §1.4 — this function used to carry its own copy of the
// legacy→canonical map, identical to the one in offerConfig.validator. Two copies
// of the same vocabulary is how they drift, and the migration, the write-time
// validator and this pricing path all have to agree or a stored offer silently
// stops applying. Delegating keeps one map.
//
// Behaviour is unchanged: the validator's map covers every case this version
// handled (discount, volume / volume discount / volume_discount, bogo, bundle,
// free gift / free_gift, percentage → discount, flat → discount) and passes
// anything unrecognised through lowercased — which is what 'prebook' and the old
// `return t` default already did.
const { normalizeOfferType } = require('./offerConfig.validator');

function extractProductIds(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map(p => typeof p === 'string' ? p : (p?.id || p?.product_id))
    .filter(Boolean);
}

// ── Per-type resolvers ───────────────────────────────────────────────────────

/**
 * Resolve the scope of a Discount/Volume offer.
 *
 * The 3-tier scope model (per user spec):
 *   · 'store'    — applies to entire cart (or entire bill at pay-at-store)
 *   · 'category' — applies only to items whose brand_products.section
 *                  matches offerConfig.category
 *   · 'products' — applies only to items whose product_id is in
 *                  offerConfig.products (current behavior; the default
 *                  legacy shape)
 *
 * Legacy back-compat: when offerConfig has no `scope` field, infer from
 * the products array — non-empty products array → 'products' scope, empty
 * → 'store' scope. So pre-existing campaigns keep working.
 */
function resolveScope(offerConfig) {
  if (offerConfig?.scope) return offerConfig.scope;
  const productIds = extractProductIds(offerConfig?.products);
  return productIds.length > 0 ? 'products' : 'store';
}

/**
 * Filter the cart to items the offer applies to, per scope.
 * Returns the filtered item list (may be empty if no match).
 */
function filterItemsByScope(items, scope, offerConfig, productMetaMap) {
  if (scope === 'store' || !scope) return items;
  if (scope === 'products') {
    const scopedIds = extractProductIds(offerConfig?.products);
    if (scopedIds.length === 0) return items;   // ill-configured; treat as store
    return items.filter(i => scopedIds.includes(i.product_id));
  }
  if (scope === 'category') {
    // Hierarchy-aware (offer-category-hierarchy): a node-scoped offer applies to
    // any product whose ancestor path contains the offer's node — so it works
    // at any level (segment / category / subcategory like "Men › … › Jeans").
    const nodeId = offerConfig?.category_node_id;
    if (nodeId) {
      return items.filter(i => {
        const path = productMetaMap?.get?.(i.product_id)?.node_path;
        return Array.isArray(path) && path.includes(String(nodeId));
      });
    }
    // Legacy string match (old offers scoped by section name).
    const cat = offerConfig?.category;
    if (!cat) return items;   // ill-configured; treat as store
    return items.filter(i => {
      const section = productMetaMap?.get?.(i.product_id)?.section;
      return section && String(section).toLowerCase() === String(cat).toLowerCase();
    });
  }
  return items;
}

function resolveDiscount({ offerConfig, items, priceMap, variantPriceMap, productMetaMap, billAmount }) {
  const subType = offerConfig?.sub_type || 'pct';
  const value = Number(offerConfig?.value || 0);
  const scope = resolveScope(offerConfig);

  // Pay-at-store (no items, just a bill total).
  // Only 'store' scope makes sense — category/product scope can't be
  // resolved from a free-form bill (we don't know which items were on it).
  if (!items || items.length === 0) {
    if (billAmount == null) return { discount_amount: 0, applied_to: 'bill_amount', reason: 'No bill amount' };
    if (scope !== 'store') {
      return {
        discount_amount: 0,
        applied_to: 'bill_amount',
        reason: scope === 'category'
          ? `This offer is scoped to "${offerConfig.category}" — applies online only, not on walk-in bills`
          : 'This offer is scoped to specific products — applies online only, not on walk-in bills',
      };
    }
    if (subType === 'flat') {
      const discount = Math.min(value, Number(billAmount));
      return {
        discount_amount: r2(discount),
        applied_to: 'bill_amount',
        reason: `Flat ₹${value} off your bill`,
      };
    }
    return {
      discount_amount: r2(Number(billAmount) * value / 100),
      applied_to: 'bill_amount',
      reason: `${value}% off your bill`,
    };
  }

  // Online order — filter items by scope, then compute discount on subtotal.
  const applicableItems = filterItemsByScope(items, scope, offerConfig, productMetaMap);
  const subtotal = itemsTotal(applicableItems, priceMap, variantPriceMap);

  if (applicableItems.length === 0) {
    const reason = scope === 'category'
      ? `Offer applies to ${offerConfig.category} only — no items from that category in your cart`
      : scope === 'products'
        ? 'Offer does not apply to any items in cart'
        : 'No items in cart';
    return { discount_amount: 0, applied_to: 'scope_subtotal', reason };
  }

  const scopeLabel = scope === 'store'
    ? 'your order'
    : scope === 'category'
      ? `your ${offerConfig.category} items`
      : `${applicableItems.length} eligible item(s)`;
  const appliedTo = scope === 'store' ? 'cart_total' : 'scope_subtotal';

  if (subType === 'flat') {
    const discount = Math.min(value, subtotal);
    return {
      discount_amount: r2(discount),
      applied_to: appliedTo,
      reason: `₹${value} off ${scopeLabel}`,
    };
  }
  return {
    discount_amount: r2(subtotal * value / 100),
    applied_to: appliedTo,
    reason: `${value}% off ${scopeLabel}`,
  };
}

function resolveVolume({ offerConfig, items, priceMap, variantPriceMap, productMetaMap }) {
  const tiers = Array.isArray(offerConfig?.tiers) ? offerConfig.tiers : [];
  const scope = resolveScope(offerConfig);
  const applicable = filterItemsByScope(items, scope, offerConfig, productMetaMap);
  const subtotal = itemsTotal(applicable, priceMap, variantPriceMap);

  // Phase 3 (offer-new-shapes) — QUANTITY tiers: gate on total units in scope
  // (buy N → % off), not spend. Discount still applies to the scope subtotal.
  if (offerConfig?.mode === 'quantity') {
    const qty = applicable.reduce((s, i) => s + Number(i.quantity || 0), 0);
    let best = null;
    for (const t of tiers) {
      const min = Number(t.min_qty || 0);
      if (qty >= min && (best == null || min > Number(best.min_qty || 0))) best = t;
    }
    const ctx = scope === 'category' ? ` on ${offerConfig.category}` : scope === 'products' ? ' on eligible items' : '';
    if (!best) {
      const lowest = tiers.reduce((acc, t) => (acc == null || Number(t.min_qty || 0) < Number(acc.min_qty || 0) ? t : acc), null);
      return {
        discount_amount: 0,
        applied_to: 'scope_subtotal',
        reason: lowest ? `Buy ${lowest.min_qty}${ctx} to unlock ${lowest.pct_off}% off` : 'Quantity threshold not met',
      };
    }
    return {
      discount_amount: r2(subtotal * Number(best.pct_off) / 100),
      applied_to: scope === 'store' ? 'cart_total' : 'scope_subtotal',
      reason: `${best.pct_off}% off — buy ≥ ${best.min_qty}${scope === 'category' ? ` on ${offerConfig.category}` : ''} tier`,
    };
  }

  // Pick the highest-min_spend tier whose threshold is met
  let bestTier = null;
  for (const t of tiers) {
    const min = Number(t.min_spend || 0);
    const pct = Number(t.pct_off || 0);
    if (subtotal >= min && (bestTier == null || min > Number(bestTier.min_spend || 0))) {
      bestTier = t;
    }
  }
  if (!bestTier) {
    const lowestTier = tiers.reduce((acc, t) => acc == null || Number(t.min_spend || 0) < Number(acc.min_spend || 0) ? t : acc, null);
    const scopeContext = scope === 'category' ? ` on ${offerConfig.category}` : scope === 'products' ? ' on eligible items' : '';
    return {
      discount_amount: 0,
      applied_to: 'scope_subtotal',
      reason: lowestTier
        ? `Spend ₹${lowestTier.min_spend}${scopeContext} to unlock ${lowestTier.pct_off}% off`
        : 'Volume threshold not met',
    };
  }

  return {
    discount_amount: r2(subtotal * Number(bestTier.pct_off) / 100),
    applied_to: scope === 'store' ? 'cart_total' : 'scope_subtotal',
    reason: `${bestTier.pct_off}% off — spend ≥ ₹${bestTier.min_spend} tier${scope === 'category' ? ` on ${offerConfig.category}` : ''}`,
  };
}

function resolveBogo({ offerConfig, items, priceMap, variantPriceMap }) {
  // Phase 3 (offer-new-shapes) — SAME-PRODUCT BOGO: buy N of a product, get M
  // of the SAME product free (any variant). Free units = complete groups of
  // (buy+free) in the cart × free_qty. Variant-agnostic: count all units of the
  // product across variants.
  if (offerConfig?.product?.id) {
    const p = offerConfig.product;
    const buyN = Math.max(1, Number(offerConfig.buy_qty || 1));
    const freeN = Math.max(1, Number(offerConfig.free_qty || 1));
    const group = buyN + freeN;
    const qty = items.filter(i => i.product_id === p.id).reduce((s, i) => s + Number(i.quantity || 0), 0);
    const freeCount = Math.floor(qty / group) * freeN;
    if (freeCount === 0) {
      const need = Math.max(1, group - qty);
      return {
        discount_amount: 0,
        applied_to: 'cart_total',
        reason: `Buy ${buyN} ${p.name || 'item'}, get ${freeN} free — add ${need} more to unlock`,
      };
    }
    const unitPrice = priceMap.get(p.id) || Number(p.price) || 0;
    return {
      discount_amount: r2(unitPrice * freeCount),
      applied_to: 'cart_total',
      reason: `${freeCount}× ${p.name || 'item'} free (buy ${buyN} get ${freeN})`,
      adjustments: [{ product_id: p.id, free_qty: freeCount, reason: `Buy ${buyN} get ${freeN} free` }],
    };
  }

  // OLD shape (buy_product + get_product) — left intact for existing offers.
  const buy = offerConfig?.buy_product;
  const get = offerConfig?.get_product;
  if (!buy?.id || !get?.id) {
    return { discount_amount: 0, applied_to: 'cart_total', reason: 'BOGO offer mis-configured' };
  }

  // Customer must have at least 1 buy_product to trigger
  const buyQty = items.filter(i => i.product_id === buy.id).reduce((s, i) => s + Number(i.quantity || 0), 0);
  const getQty = items.filter(i => i.product_id === get.id).reduce((s, i) => s + Number(i.quantity || 0), 0);

  if (buyQty < 1) {
    return { discount_amount: 0, applied_to: 'cart_total', reason: `Add ${buy.name || 'the qualifying item'} to unlock free ${get.name || 'gift'}` };
  }

  // Free count = min(buyQty, getQty in cart) — we discount ONLY the get items
  // already in cart. We don't auto-add the free item; brand-side fulfillment
  // gives it. (Future: cart auto-add UX — Tier 3.)
  const freeCount = Math.min(buyQty, getQty);
  if (freeCount === 0) {
    return {
      discount_amount: 0,
      applied_to: 'cart_total',
      reason: `Add ${get.name || 'the free item'} to your cart to claim the BOGO discount`,
    };
  }

  const getPrice = priceMap.get(get.id) || 0;
  return {
    discount_amount: r2(getPrice * freeCount),
    applied_to: 'cart_total',
    reason: `${freeCount}× ${get.name || 'item'} free (BOGO)`,
    adjustments: [{ product_id: get.id, free_qty: freeCount }],
  };
}

function resolveBundle({ offerConfig, items, priceMap, variantPriceMap }) {
  const bundleIds = extractProductIds(offerConfig?.products);
  const bundlePrice = Number(offerConfig?.bundle_price || 0);

  if (bundleIds.length === 0 || !bundlePrice) {
    return { discount_amount: 0, applied_to: 'cart_total', reason: 'Bundle offer mis-configured' };
  }

  // All bundle products must be in cart (qty ≥ 1)
  const missing = bundleIds.filter(id => !items.some(i => i.product_id === id));
  if (missing.length > 0) {
    return {
      discount_amount: 0,
      applied_to: 'cart_total',
      reason: `Add ${missing.length} more bundle item(s) to claim ₹${bundlePrice} bundle price`,
    };
  }

  const bundleSubtotal = itemsTotal(
    items.filter(i => bundleIds.includes(i.product_id)).map(i => ({ ...i, quantity: 1 })),
    priceMap,
    variantPriceMap
  );

  if (bundleSubtotal <= bundlePrice) {
    return { discount_amount: 0, applied_to: 'cart_total', reason: 'Bundle pricing already at/below sum — no extra discount' };
  }
  return {
    discount_amount: r2(bundleSubtotal - bundlePrice),
    applied_to: 'cart_total',
    reason: `${bundleIds.length}-item bundle for ₹${bundlePrice}`,
  };
}

function resolveFreeGift({ offerConfig, items, priceMap, variantPriceMap }) {
  const offers = Array.isArray(offerConfig?.offers) ? offerConfig.offers : [];
  if (offers.length === 0) return { discount_amount: 0, applied_to: 'cart_total', reason: 'Free gift offer mis-configured' };

  // For each pair: if main is in cart, customer gets gift free. Sum gift prices
  // present in cart (so they're not charged for the gift item).
  let total = 0;
  const adjustments = [];
  for (const pair of offers) {
    const main = pair?.main;
    const gift = pair?.gift;
    if (!main?.id || !gift?.id) continue;
    const hasMain = items.some(i => i.product_id === main.id && Number(i.quantity || 0) > 0);
    if (!hasMain) continue;
    const giftQty = items.filter(i => i.product_id === gift.id).reduce((s, i) => s + Number(i.quantity || 0), 0);
    if (giftQty === 0) continue;
    const giftPrice = priceMap.get(gift.id) || 0;
    total += giftPrice * giftQty;
    adjustments.push({ product_id: gift.id, free_qty: giftQty, reason: `Free with ${main.name}` });
  }

  return {
    discount_amount: r2(total),
    applied_to: 'cart_total',
    reason: total > 0 ? `Free gift(s) included` : 'Add a qualifying main product to claim free gift(s)',
    adjustments,
  };
}

// ── Public ───────────────────────────────────────────────────────────────────

function resolveOfferDiscount({ offerType, offerConfig, items = [], priceMap, variantPriceMap, productMetaMap, billAmount } = {}) {
  const type = normalizeOfferType(offerType);
  const ctx = {
    offerConfig: offerConfig || {},
    items: items || [],
    priceMap: priceMap || new Map(),
    variantPriceMap,
    productMetaMap,
    billAmount,
  };

  switch (type) {
    case 'discount':  return resolveDiscount(ctx);
    case 'volume':    return resolveVolume(ctx);
    case 'bogo':      return resolveBogo(ctx);
    case 'bundle':    return resolveBundle(ctx);
    case 'free_gift': return resolveFreeGift(ctx);
    case 'prebook':   return { discount_amount: 0, applied_to: 'cart_total', reason: 'Prebook offer (token-only at advance time)' };
    default:          return { discount_amount: 0, applied_to: 'cart_total', reason: `Unknown offer type: ${offerType}` };
  }
}

module.exports = {
  resolveOfferDiscount,
  normalizeOfferType,
  itemsTotal,
  lineItemPrice,
  // Exported for tests + analytics:
  _internals: { resolveDiscount, resolveVolume, resolveBogo, resolveBundle, resolveFreeGift },
};
