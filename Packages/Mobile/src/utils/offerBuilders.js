/* ════════════════════════════════════════════════════════════════════════
   Offer config builders (features/brand-mobile-offers, A7).
   Mirrors backend services/offerConfig.validator.js so the mobile builders
   for volume / BOGO / bundle produce configs the API accepts — these types
   previously forced the brand onto the web dashboard.
   Pure: returns { ok, config } or { ok:false, error }.
   ══════════════════════════════════════════════════════════════════════ */

const pos = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

/** discount: { sub_type: 'pct'|'flat', value, scope:'store' } */
export function buildDiscount({ subType, value }) {
  const v = Number(value);
  if (!pos(v)) return { ok: false, error: 'Enter a positive value.' };
  if (subType === 'pct' && v > 100) return { ok: false, error: 'Percentage cannot exceed 100.' };
  return { ok: true, config: { sub_type: subType, value: v, scope: 'store' } };
}

/** volume: tiers gate on min_qty (mode 'quantity') or min_spend (mode 'spend'). */
export function buildVolume({ mode, tiers }) {
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
  return { ok: true, config: { mode: mode === 'quantity' ? 'quantity' : 'spend', tiers: out, scope: 'store' } };
}

/** bogo (same-product form): { product:{id}, buy_qty, free_qty } */
export function buildBogo({ product, buyQty, freeQty }) {
  if (!product?.id) return { ok: false, error: 'Pick the product this offer applies to.' };
  if (!pos(buyQty)) return { ok: false, error: 'Buy quantity must be a positive number.' };
  if (!pos(freeQty)) return { ok: false, error: 'Free quantity must be a positive number.' };
  return { ok: true, config: { product: { id: product.id }, buy_qty: Number(buyQty), free_qty: Number(freeQty) } };
}

/** bundle: products[] (>= 2) + bundle_price */
export function buildBundle({ products, price }) {
  const ids = (products || []).map(p => p?.id).filter(Boolean);
  if (ids.length < 2) return { ok: false, error: 'A bundle needs at least 2 products.' };
  if (!pos(price)) return { ok: false, error: 'Enter a positive bundle price.' };
  return { ok: true, config: { products: ids.map(id => ({ id })), bundle_price: Number(price) } };
}

export const OFFER_TYPES = [
  { key: 'discount', label: 'Discount' },
  { key: 'volume',   label: 'Volume' },
  { key: 'bogo',     label: 'BOGO' },
  { key: 'bundle',   label: 'Bundle' },
];
