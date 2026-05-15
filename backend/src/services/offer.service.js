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

function normalizeOfferType(s) {
  if (!s) return null;
  const t = String(s).toLowerCase().trim();
  if (t === 'discount') return 'discount';
  if (t === 'volume' || t === 'volume discount' || t === 'volume_discount') return 'volume';
  if (t === 'bogo') return 'bogo';
  if (t === 'bundle') return 'bundle';
  if (t === 'free gift' || t === 'free_gift') return 'free_gift';
  // Legacy short types from the original campaign_offers enum
  if (t === 'percentage') return 'discount';   // map to discount sub_type='pct'
  if (t === 'flat') return 'discount';         // map to discount sub_type='flat'
  if (t === 'prebook') return 'prebook';
  return t;
}

function extractProductIds(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map(p => typeof p === 'string' ? p : (p?.id || p?.product_id))
    .filter(Boolean);
}

// ── Per-type resolvers ───────────────────────────────────────────────────────

function resolveDiscount({ offerConfig, items, priceMap, variantPriceMap, billAmount }) {
  const subType = offerConfig?.sub_type || 'pct';
  const value = Number(offerConfig?.value || 0);
  const scopedIds = extractProductIds(offerConfig?.products);

  // Pay-at-store (no items) — applies to bill_amount
  if (!items || items.length === 0) {
    if (billAmount == null) return { discount_amount: 0, applied_to: 'bill_amount', reason: 'No bill amount' };
    if (subType === 'flat') {
      const discount = Math.min(value, Number(billAmount));
      return {
        discount_amount: r2(discount),
        applied_to: 'bill_amount',
        reason: `Flat ₹${value} off your bill`,
      };
    }
    // pct (default)
    return {
      discount_amount: r2(Number(billAmount) * value / 100),
      applied_to: 'bill_amount',
      reason: `${value}% off your bill`,
    };
  }

  // Online order — apply to scoped subtotal (or full cart if no scope)
  const applicableItems = scopedIds.length === 0
    ? items
    : items.filter(i => scopedIds.includes(i.product_id));
  const subtotal = itemsTotal(applicableItems, priceMap, variantPriceMap);

  if (applicableItems.length === 0) {
    return { discount_amount: 0, applied_to: 'scope_subtotal', reason: 'Offer does not apply to any items in cart' };
  }

  if (subType === 'flat') {
    const discount = Math.min(value, subtotal);
    return {
      discount_amount: r2(discount),
      applied_to: scopedIds.length === 0 ? 'cart_total' : 'scope_subtotal',
      reason: `₹${value} off ${scopedIds.length === 0 ? 'your order' : applicableItems.length + ' eligible item(s)'}`,
    };
  }
  // pct
  return {
    discount_amount: r2(subtotal * value / 100),
    applied_to: scopedIds.length === 0 ? 'cart_total' : 'scope_subtotal',
    reason: `${value}% off ${scopedIds.length === 0 ? 'your order' : applicableItems.length + ' eligible item(s)'}`,
  };
}

function resolveVolume({ offerConfig, items, priceMap, variantPriceMap }) {
  const tiers = Array.isArray(offerConfig?.tiers) ? offerConfig.tiers : [];
  const scopedIds = extractProductIds(offerConfig?.products);
  const applicable = scopedIds.length === 0 ? items : items.filter(i => scopedIds.includes(i.product_id));
  const subtotal = itemsTotal(applicable, priceMap, variantPriceMap);

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
    return {
      discount_amount: 0,
      applied_to: 'scope_subtotal',
      reason: lowestTier
        ? `Spend ₹${lowestTier.min_spend} more eligible to unlock ${lowestTier.pct_off}% off`
        : 'Volume threshold not met',
    };
  }

  return {
    discount_amount: r2(subtotal * Number(bestTier.pct_off) / 100),
    applied_to: scopedIds.length === 0 ? 'cart_total' : 'scope_subtotal',
    reason: `${bestTier.pct_off}% off — spend ≥ ₹${bestTier.min_spend} tier`,
  };
}

function resolveBogo({ offerConfig, items, priceMap, variantPriceMap }) {
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

function resolveOfferDiscount({ offerType, offerConfig, items = [], priceMap, variantPriceMap, billAmount } = {}) {
  const type = normalizeOfferType(offerType);
  const ctx = { offerConfig: offerConfig || {}, items: items || [], priceMap: priceMap || new Map(), variantPriceMap, billAmount };

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
