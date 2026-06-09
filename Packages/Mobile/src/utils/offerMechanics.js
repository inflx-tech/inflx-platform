/**
 * offerMechanics.js — shared, vertical-agnostic offer-type logic for the follower
 * app. Mirrors backend/src/services/offer.service.js (resolveOfferDiscount): the
 * SERVER stays authoritative on pricing — this module only (a) classifies the type,
 * (b) composes the cart items the checkout sends, and (c) labels order lines.
 *
 * Contract: features/follower-offer-mechanics.
 *
 * The five types + their config shapes (from offer.service.js / brandOffers.adapter
 * `config`): discount {sub_type,value} · volume {tiers:[{min_spend,pct_off}]} ·
 * bogo {buy_product,get_product} · bundle {products[],bundle_price} ·
 * free_gift {offers:[{main,gift}]}.
 */

// Normalize BOTH vocabularies (library + legacy display) → one canonical kind.
export function offerKind(offerType) {
  const t = String(offerType || '').toLowerCase().trim();
  if (['discount', 'percentage', 'flat', 'pct'].includes(t)) return 'discount';
  if (['volume', 'volume_discount'].includes(t)) return 'volume';
  if (t === 'bogo') return 'bogo';
  if (t === 'bundle') return 'bundle';
  if (['free_gift', 'free gift', 'gift'].includes(t)) return 'free_gift';
  return t || null;
}

// Per-kind presentation + the cart rule. `anyBill` = applies to a free-form
// pay-at-store bill (no item pick); the rest still work at pay-at-store but only
// when the items were picked in-app (so we know which products are free/bundled).
export const OFFER_META = {
  discount:  { key: 'discount',  label: 'DISCOUNT',     icon: '⏷',  color: '#D9531E', anyBill: true  },
  volume:    { key: 'volume',    label: 'VOLUME',       icon: '▲',  color: '#B98A2E', anyBill: true  },
  bogo:      { key: 'bogo',      label: 'BUY 1 GET 1',  icon: '🎁', color: '#8B4A2F', anyBill: false },
  bundle:    { key: 'bundle',    label: 'BUNDLE',       icon: '📦', color: '#6D4EA3', anyBill: false },
  free_gift: { key: 'free_gift', label: 'FREE GIFT',    icon: '🎀', color: '#3F8A57', anyBill: false },
};
export function offerMeta(offerType) {
  return OFFER_META[offerKind(offerType)] || null;
}

const num = (v) => (v != null && isFinite(Number(v)) ? Number(v) : null);

/**
 * composeCart(offer, baseItem) → { items, note, freeIds }
 *
 * baseItem = the product the user is on: { id, name, price, quantity? }.
 * Returns the full item list the checkout should carry so the server's
 * resolveOfferDiscount prices the deal. Extra items (BOGO get, bundle products,
 * gift) are added so they're present in the cart; the server discounts them.
 * `freeIds` = product ids that should display at ₹0 (engine zeroes them).
 */
export function composeCart(offer, baseItem) {
  const kind = offerKind(offer?.offer_type);
  const cfg = offer?.config || {};
  const base = { ...baseItem, quantity: baseItem?.quantity || 1 };
  const mk = (ref, extra) => ({
    id: ref.id,
    product_id: ref.id,
    name: ref.name || 'Item',
    price: num(ref.price) != null ? num(ref.price) : 0,
    quantity: 1,
    ...extra,
  });

  if (kind === 'bogo' && cfg.buy_product && cfg.get_product) {
    const qty = base.quantity;
    const buy = { ...mk(cfg.buy_product), quantity: qty };
    const get = { ...mk(cfg.get_product, { _free: true }), quantity: qty };
    return {
      items: [buy, get],
      note: `Free ${cfg.get_product.name || 'item'} added — quantity matched`,
      freeIds: [cfg.get_product.id],
    };
  }
  if (kind === 'bundle' && Array.isArray(cfg.products) && cfg.products.length) {
    return {
      items: cfg.products.map(p => mk(p, { _bundle: true })),
      note: `All ${cfg.products.length} bundle items added`,
      freeIds: [],
    };
  }
  if (kind === 'free_gift' && Array.isArray(cfg.offers) && cfg.offers.length) {
    // Use the pair whose main matches the base product, else the first pair.
    const pair = cfg.offers.find(o => o.main && o.main.id === base.id) || cfg.offers[0];
    const main = pair?.main ? { ...mk(pair.main), quantity: base.quantity } : base;
    const items = [main];
    const freeIds = [];
    if (pair?.gift) { items.push(mk(pair.gift, { _gift: true })); freeIds.push(pair.gift.id); }
    return { items, note: `Free ${pair?.gift?.name || 'gift'} added`, freeIds };
  }
  // discount / volume / unknown → just the picked item; server prices it.
  return { items: [base], note: null, freeIds: [] };
}

/**
 * orderLines(itemsJson, adjustments) → [{ name, qty, price, free, badge }]
 * Labels free / gift / bundle lines for the Orders / OrderDetail screens.
 * adjustments come from follower_transactions/order meta (engine output):
 * [{ product_id, free_qty, reason? }].
 */
export function orderLines(itemsJson, adjustments) {
  const items = Array.isArray(itemsJson) ? itemsJson : [];
  const adj = Array.isArray(adjustments) ? adjustments : [];
  const freeMap = new Map(adj.map(a => [a.product_id, a]));
  return items.map(it => {
    const a = freeMap.get(it.product_id);
    const isFree = !!a && Number(a.free_qty || 0) > 0;
    return {
      name: it.name || 'Item',
      qty: Number(it.quantity || 1),
      price: num(it.price) || 0,
      free: isFree,
      badge: isFree ? (/(gift)/i.test(a.reason || '') ? 'GIFT' : 'FREE') : null,
    };
  });
}

// Bundle savings preview (only when every product carries a price).
export function bundleSavings(cfg) {
  if (!cfg || !Array.isArray(cfg.products) || cfg.bundle_price == null) return null;
  const prices = cfg.products.map(p => num(p.price));
  if (prices.some(p => p == null)) return null;
  const sum = prices.reduce((s, p) => s + p, 0);
  const save = Math.round((sum - Number(cfg.bundle_price)) * 100) / 100;
  return save > 0 ? { sum, save } : null;
}
