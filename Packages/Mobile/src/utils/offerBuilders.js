/* ════════════════════════════════════════════════════════════════════════
   Offer config builders.
   Contract: features/stage-2-offers-parity (P1, P2)
   Originally features/brand-mobile-offers A7.

   ONE SHAPE, TWO BUILDERS — AND THAT IS THE WHOLE DANGER
   These functions must produce byte-for-byte what Packages/brand-web/components/OfferBuilder.js
   produces. Not "compatible". The same. `campaignChannels.js` opens with the reason:

     "already had to clean up two duplicated vocabularies (offer types written differently by
      web and mobile, and a duplicated offer-type normaliser). A third is not worth it."

   `offerParity.test.js` reads BOTH files and compares their output, so a drift fails a check
   rather than being discovered in a shopper's basket.

   WHAT WAS WRONG BEFORE, AND WHY IT MATTERED
   1. `scope` was hardcoded to 'store' in buildDiscount AND buildVolume. Every discount and
      every volume offer built on a phone applied to the whole store, whatever the brand chose.
      Both offers in production are whole-store; there is no way to tell whether that was
      intended or imposed.
   2. Products were written as `{ id }` where web writes `{ id, name, price }`. The server only
      needs the id — but **web's editor rehydrates its product pickers straight out of the
      stored config** (`d.bnd_prods = c.products`), so a bundle built on a phone opened on web
      showed products with no name and no price.

   Pure. Returns { ok, config } or { ok: false, error }.
   ══════════════════════════════════════════════════════════════════════ */

const pos = (n) => Number.isFinite(Number(n)) && Number(n) > 0;
const num = (v) => (v === '' || v == null ? 0 : Number(v));

/**
 * A product as it is stored inside a config. Web's `prod()`, exactly.
 *
 * The id is what the server resolves against the catalogue; the name and price are what an
 * editor shows when it reopens the offer without re-fetching. Dropping them is invisible until
 * somebody edits the offer on the other client.
 */
export const prod = (p) => (p ? { id: p.id, name: p.name, price: p.price } : null);

export const OFFER_SCOPES = ['store', 'category', 'products'];

/**
 * The scope half of a discount or volume config.
 *
 * `category` and `category_node_id` are BOTH written when the scope is a category — the server
 * accepts either (`offerConfig.validator.js:154`) and the shopper-side SQL prefers the node id
 * when it is present, falling back to matching the section by name. Writing one and not the
 * other is how an offer stops matching anything after a category is renamed.
 */
function scopePart({ scope, category, categoryNodeId, products }) {
  const s = OFFER_SCOPES.includes(scope) ? scope : 'store';
  return {
    scope: s,
    category: s === 'category' ? (category || null) : null,
    category_node_id: s === 'category' ? (categoryNodeId || null) : null,
    products: s === 'products' ? (products || []).map(prod) : [],
  };
}

/** Rejects a scope the brand has not finished choosing. Message, not a code. */
function scopeError({ scope, category, categoryNodeId, products }) {
  if (scope === 'category' && !category && !categoryNodeId) {
    return 'Pick the category this offer covers.';
  }
  if (scope === 'products' && !(products || []).length) {
    return 'Pick at least one product this offer covers.';
  }
  return null;
}

/** discount: { sub_type, value, scope, category, category_node_id, products } */
export function buildDiscount({ subType, value, scope, category, categoryNodeId, products }) {
  const v = Number(value);
  if (!pos(v)) return { ok: false, error: 'Enter a positive value.' };
  if (subType === 'pct' && v > 100) return { ok: false, error: 'Percentage cannot exceed 100.' };
  const bad = scopeError({ scope, category, categoryNodeId, products });
  if (bad) return { ok: false, error: bad };
  return {
    ok: true,
    config: {
      sub_type: subType,
      value: v,
      ...scopePart({ scope, category, categoryNodeId, products }),
    },
  };
}

/** volume: tiers gate on min_qty (mode 'quantity') or min_spend (mode 'spend'), plus scope. */
export function buildVolume({ mode, tiers, scope, category, categoryNodeId, products }) {
  const rows = (tiers || []).filter(t => t && (t.threshold !== '' && t.threshold != null));
  if (rows.length === 0) return { ok: false, error: 'Add at least one tier.' };
  const out = [];
  for (const t of rows) {
    if (!pos(t.threshold)) {
      return { ok: false, error: mode === 'quantity' ? 'Each tier needs a positive quantity.' : 'Each tier needs a positive spend.' };
    }
    if (!pos(t.pctOff) || Number(t.pctOff) > 100) {
      return { ok: false, error: 'Each tier needs a discount between 1 and 100%.' };
    }
    out.push(mode === 'quantity'
      ? { min_qty: Number(t.threshold), pct_off: Number(t.pctOff) }
      : { min_spend: Number(t.threshold), pct_off: Number(t.pctOff) });
  }
  const bad = scopeError({ scope, category, categoryNodeId, products });
  if (bad) return { ok: false, error: bad };
  return {
    ok: true,
    config: {
      mode: mode === 'quantity' ? 'quantity' : 'spend',
      tiers: out,
      ...scopePart({ scope, category, categoryNodeId, products }),
    },
  };
}

/** bogo (same-product form): { product, buy_qty, free_qty } */
export function buildBogo({ product, buyQty, freeQty }) {
  if (!product?.id) return { ok: false, error: 'Pick the product this offer applies to.' };
  if (!pos(buyQty)) return { ok: false, error: 'Buy quantity must be a positive number.' };
  if (!pos(freeQty)) return { ok: false, error: 'Free quantity must be a positive number.' };
  return {
    ok: true,
    config: { product: prod(product), buy_qty: num(buyQty) || 1, free_qty: num(freeQty) || 1 },
  };
}

/** bundle: products[] (>= 2) + bundle_price */
export function buildBundle({ products, price }) {
  const picked = (products || []).filter(p => p && p.id);
  if (picked.length < 2) return { ok: false, error: 'A bundle needs at least 2 products.' };
  if (!pos(price)) return { ok: false, error: 'Enter a positive bundle price.' };
  return { ok: true, config: { products: picked.map(prod), bundle_price: num(price) } };
}

/**
 * free_gift: { offers: [{ main, gift }] } — buy the main product, get the gift.
 *
 * The fifth type. It existed on web and had no phone implementation at all, so a brand who
 * wanted to give something away had to open a laptop.
 *
 * More than one pairing is allowed, because web allows it: "buy any saree, get a bindi set"
 * and "buy any lehenga, get a clutch" are one offer with two pairings, not two offers.
 */
export function buildFreeGift({ pairs }) {
  const rows = (pairs || []).filter(p => p && (p.main || p.gift));
  if (rows.length === 0) return { ok: false, error: 'Add at least one pairing.' };
  for (const p of rows) {
    if (!p.main?.id) return { ok: false, error: 'Pick the product they have to buy.' };
    if (!p.gift?.id) return { ok: false, error: 'Pick the product they get free.' };
  }
  return { ok: true, config: { offers: rows.map(p => ({ main: prod(p.main), gift: prod(p.gift) })) } };
}

export const OFFER_TYPES = [
  { key: 'discount', label: 'Discount' },
  { key: 'volume', label: 'Volume' },
  { key: 'bogo', label: 'BOGO' },
  { key: 'bundle', label: 'Bundle' },
  { key: 'free_gift', label: 'Free gift' },
];

/**
 * Where a shopper may redeem an offer. `brand_offers.availing_modes`.
 *
 * ⚠️ The phone has NEVER sent this. `createOffer` deliberately omits the column when it is not
 * supplied so the NOT NULL DEFAULT '{pay_at_store,online_order}' applies — so every offer built
 * on a phone silently became redeemable both ways, whether or not the brand wanted that. Both
 * offers in production show exactly that.
 */
export const AVAILING_MODES = [
  { key: 'pay_at_store', label: 'Pay at the store' },
  { key: 'online_order', label: 'Order online' },
  { key: 'prebook', label: 'Pre-book' },
  // Docs/THE_CUT.md pass 1 — 'enquiry' removed, so a brand can no longer build an
  // offer whose only way to act on it is a screen that no longer exists.
];

/**
 * The sentence web shows, and the phone did not.
 *
 * A pay-at-store bill is a paper bill. There is no basket, so there is nothing to scope: the
 * shop cannot know that three of the seven lines were sarees. Only a whole-store percentage
 * survives that. Saying so BEFORE the offer is saved beats a brand wondering for a month why
 * it never applies in the shop.
 */
export function applicabilityHint(offerType, scope) {
  const scoped = scope === 'category' || scope === 'products';
  if (offerType === 'bogo' || offerType === 'bundle' || offerType === 'free_gift') {
    return 'Applies to online orders. These need a basket, so a pay-at-store bill cannot honour them.';
  }
  if (scoped) {
    return 'Applies to online orders. On a pay-at-store bill only whole-store % offers apply — a paper bill cannot be scoped to a category or to chosen products.';
  }
  return 'Applies to online orders and pay-at-store bills.';
}

/**
 * The validity window. `store_starts_at` / `store_ends_at` on a library offer,
 * `offer_valid_from` / `offer_valid_until` on a creator's own.
 *
 * Both ends are already enforced at checkout (`transaction.controller.js`) and neither has ever
 * had a way in. Blank means no limit, on either end.
 */
export function buildWindow({ startsAt, endsAt }) {
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return { ok: false, error: 'The end date is before the start date.' };
  }
  return { ok: true, window: { startsAt: startsAt || null, endsAt: endsAt || null } };
}
