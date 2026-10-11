'use strict';

/**
 * stock.service.js — stock is real (rules R6): it goes down when an order is placed (or held for a
 * 15-minute online payment, 6.8) and back up when an item is cancelled or a hold ends.
 * Contract: features/shopper-ordering (S7).
 *
 * Where stock lives: `brand_products.variants_json` colours[].sizes[].stock (the website wizard's
 * shape), else a top-level sizes[] list, else `brand_products.stock` for a product with no sizes.
 * A blank stock is NOT TRACKED and never blocks. Gifts: `gift_items.stock`, and each pool gift's
 * `gifts_given` against its `gift_limit` (1.7, 6.4).
 *
 * Every function runs inside the caller's transaction and locks the rows it changes, in id
 * order, so two shoppers racing for the last unit can never both get it.
 */

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const tracked = (s) => s && s.stock != null && s.stock !== '' && Number.isFinite(Number(s.stock));

/** Finds the size entry for colour/size inside a variants object. Null = the product has no sizes. */
function sizeEntry(vj, colour, size) {
  if (!vj || typeof vj !== 'object') return null;
  const colors = Array.isArray(vj.colors) ? vj.colors : [];
  const withSizes = colors.filter((c) => Array.isArray(c && c.sizes) && c.sizes.length);
  if (withSizes.length) {
    const c = withSizes.length === 1 && !(withSizes[0].color ?? withSizes[0].name) ? withSizes[0]
      : withSizes.find((x) => same(x.color ?? x.name, colour));
    if (!c) return { missing: true };
    const s = c.sizes.find((x) => same(x && (x.size ?? x.name), size));
    return s ? { entry: s } : { missing: true };
  }
  if (Array.isArray(vj.sizes) && vj.sizes.length) {
    const i = vj.sizes.findIndex((x) => same(typeof x === 'object' ? (x.size ?? x.name) : x, size));
    if (i < 0) return { missing: true };
    if (typeof vj.sizes[i] !== 'object') return { entry: null };     // a plain size name: not tracked
    return { entry: vj.sizes[i] };
  }
  return null;
}

/** Every size entry of a variants object: the colours' sizes, else the top-level list. */
function sizeEntries(vj) {
  if (!vj || typeof vj !== 'object') return [];
  const colors = Array.isArray(vj.colors) ? vj.colors : [];
  const withSizes = colors.filter((c) => Array.isArray(c && c.sizes) && c.sizes.length);
  if (withSizes.length) return withSizes.flatMap((c) => c.sizes);
  return Array.isArray(vj.sizes) ? vj.sizes : [];
}

/** All the stock of a product with sizes, when every size is tracked; null when any is not, or it has no sizes. */
function sizesTotal(vj) {
  const es = sizeEntries(vj);
  if (!es.length || !es.every((s) => s && typeof s === 'object' && tracked(s))) return null;
  return es.reduce((n, s) => n + Math.max(0, Number(s.stock)), 0);
}

/**
 * Can anything of this product still be bought? (shopper-app-fixes F6)
 * A product with sizes is in stock while ANY size is — its own stock number is not asked (it used to
 * be, so a product sold out in every size still looked in stock). A size with a blank stock is not
 * tracked and never blocks. A product with no sizes answers from its own number.
 */
function available(product) {
  let vj = product && product.variants_json;
  if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = null; } }
  const es = sizeEntries(vj);
  if (es.length) return es.some((s) => !s || typeof s !== 'object' || !tracked(s) || Number(s.stock) > 0);
  return !product || product.stock == null || Number(product.stock) > 0;
}

/* ───────────────────────────────────────────── stock asked once (features/stock-asked-once) */

/** A stock as it was typed: empty or not a number → null (not counted, never blocks); a negative → 0. */
function cleanStock(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * The product's own number (`brand_products.stock`), as the server keeps it. A product with sizes
 * has ONE stock — its sizes — so its own number is their total when every size is counted, and
 * empty when any is not; whatever was sent for it is not asked. (It used to be saved as sent: a
 * product could say 20 on the Listings page while its only size said 0 to every shopper.)
 * A product with no sizes keeps the number sent.
 */
function ownStock(variantsJson, sent) {
  let vj = variantsJson;
  if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = null; } }
  if (sizeEntries(vj).length) return sizesTotal(vj);
  return cleanStock(sent);
}

/**
 * listing-shop-safety (B): what to save for one stock box of the Edit product form.
 *   typed   what the brand sent
 *   was     what the form showed when it was opened
 *   live    what the product holds at this moment (sales, cancels and returns since then included)
 * The form used to be saved as typed, so a description fix saved ten minutes after opening put
 * back every unit sold in between. Now: a box she did not touch keeps the live number; a box she
 * changed moves the live number by the same amount (3 shown, 10 typed, 1 live → 8); a box she
 * emptied is not counted; a box that was not counted, then or now, takes what she typed.
 */
function mergeStock(typed, was, live) {
  const t = cleanStock(typed); const w = cleanStock(was); const l = cleanStock(live);
  if (t === w) return l;
  if (t == null) return null;
  if (w == null || l == null) return t;
  return Math.max(0, l + (t - w));
}

// The stand-in size of a product that has no real size: its colour's stock is filed under it.
const ONE_SIZE_NAMES = new Set(['free size', 'one size', 'unstitched']);

/**
 * Is this a one-size product — every colour that holds sizes holds exactly one, and it is a
 * stand-in name? `choices` is orderPricing.choicesOf's list. A shirt listed in "M" only is not.
 */
function oneSizeProduct(choices) {
  const withSizes = (choices || []).filter((c) => c && Array.isArray(c.sizes) && c.sizes.length);
  return withSizes.length > 0
    && withSizes.every((c) => c.sizes.length === 1 && ONE_SIZE_NAMES.has(String(c.sizes[0].size || '').trim().toLowerCase()));
}

/**
 * Moves stock for product items. `sign` −1 takes, +1 gives back.
 * items: [{ product_id, colour, size, qty, name }]
 * @returns { ok: true } or { ok: false, short: [{ product_id, colour, size, name, left }] } (nothing changed)
 */
async function moveProducts(conn, items, sign) {
  const need = items.filter((i) => i && i.product_id && Number(i.qty) > 0);
  if (!need.length) return { ok: true };
  const ids = [...new Set(need.map((i) => i.product_id))].sort();
  const { rows } = await conn.query(
    `SELECT id, name, stock, variants_json FROM brand_products WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, { ...r, vj: r.variants_json ? JSON.parse(JSON.stringify(r.variants_json)) : null, dirtyVj: false, dirtyStock: false }]));
  const short = [];
  for (const it of need) {
    const p = byId.get(it.product_id);
    if (!p) { if (sign < 0) short.push({ product_id: it.product_id, colour: it.colour, size: it.size, name: it.name, left: 0 }); continue; }
    const qty = Number(it.qty);
    const found = sizeEntry(p.vj, it.colour, it.size);
    if (found && found.missing) {
      if (sign < 0) short.push({ product_id: p.id, colour: it.colour, size: it.size, name: p.name, left: 0 });
      continue;
    }
    if (found && found.entry) {
      if (!tracked(found.entry)) continue;
      const now = Number(found.entry.stock);
      if (sign < 0 && now < qty) { short.push({ product_id: p.id, colour: it.colour, size: it.size, name: p.name, left: Math.max(0, now) }); continue; }
      found.entry.stock = now + sign * qty;
      p.dirtyVj = true;
      continue;
    }
    if (found && found.entry === null) continue;                     // untracked size list
    if (p.stock == null) continue;                                   // no sizes, stock not tracked
    const now = Number(p.stock);
    if (sign < 0 && now < qty) { short.push({ product_id: p.id, colour: it.colour, size: it.size, name: p.name, left: Math.max(0, now) }); continue; }
    p.stock = now + sign * qty;
    p.dirtyStock = true;
  }
  if (short.length) return { ok: false, short };
  // F6: a product with sizes keeps its own stock number equal to the sum of its sizes, so everything
  // that reads that number (the feed, "is this post still in the shop") sees it sold out when every
  // size is. Only when every size is tracked; otherwise the number is left alone.
  for (const p of byId.values()) {
    if (!p.dirtyVj) continue;
    const total = sizesTotal(p.vj);
    // (An empty own number counts as different: Number(null) is 0, so a product whose last unit
    // sold kept an empty number and every reader of it went on saying "in stock".)
    if (total != null && (p.stock == null || Number(p.stock) !== total)) { p.stock = total; p.dirtyStock = true; }
  }
  for (const p of byId.values()) {
    if (p.dirtyVj) await conn.query(`UPDATE brand_products SET variants_json = $2::jsonb WHERE id = $1`, [p.id, JSON.stringify(p.vj)]);
    if (p.dirtyStock) await conn.query(`UPDATE brand_products SET stock = $2 WHERE id = $1`, [p.id, p.stock]);
  }
  return { ok: true };
}

/**
 * Moves gifts: `gift_items.stock` for gift items, the product's own stock for a store product
 * given as a gift, and `offer_pool_items.gifts_given` for both (against `gift_limit`).
 * gifts: [{ pool_item_id, gift_item_id, product_id, colour, size, qty, name }]
 */
async function moveGifts(conn, gifts, sign) {
  const need = gifts.filter((g) => g && g.pool_item_id && Number(g.qty) > 0);
  if (!need.length) return { ok: true };
  const short = [];
  const poolIds = [...new Set(need.map((g) => g.pool_item_id))].sort();
  const { rows: pool } = await conn.query(
    `SELECT id, gift_limit, gifts_given FROM offer_pool_items WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [poolIds]);
  const poolById = new Map(pool.map((r) => [r.id, r]));
  const itemIds = [...new Set(need.filter((g) => g.gift_item_id).map((g) => g.gift_item_id))].sort();
  const { rows: items } = itemIds.length
    ? await conn.query(`SELECT id, name, stock FROM gift_items WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [itemIds]) : { rows: [] };
  const itemById = new Map(items.map((r) => [r.id, { ...r, stock: Number(r.stock) }]));
  const given = new Map(pool.map((r) => [r.id, Number(r.gifts_given) || 0]));
  for (const g of need) {
    const qty = Number(g.qty);
    const pr = poolById.get(g.pool_item_id);
    if (!pr) { if (sign < 0) short.push({ ...g, left: 0 }); continue; }
    const now = given.get(pr.id);
    if (sign < 0 && pr.gift_limit != null && now + qty > Number(pr.gift_limit)) { short.push({ ...g, left: Math.max(0, Number(pr.gift_limit) - now) }); continue; }
    given.set(pr.id, Math.max(0, now - sign * qty));
    if (g.gift_item_id) {
      const it = itemById.get(g.gift_item_id);
      if (!it) { if (sign < 0) short.push({ ...g, left: 0 }); continue; }
      if (sign < 0 && it.stock < qty) { short.push({ ...g, name: it.name, left: it.stock }); continue; }
      it.stock += sign * qty;
    }
  }
  if (short.length) return { ok: false, short };
  const productGifts = need.filter((g) => !g.gift_item_id && g.product_id);
  if (productGifts.length) {
    const r = await moveProducts(conn, productGifts, sign);
    if (!r.ok) return r;
  }
  for (const [id, n] of given) await conn.query(`UPDATE offer_pool_items SET gifts_given = $2 WHERE id = $1`, [id, n]);
  for (const it of itemById.values()) await conn.query(`UPDATE gift_items SET stock = $2, updated_at = now() WHERE id = $1`, [it.id, it.stock]);
  return { ok: true };
}

/** Takes everything a checkout needs, or nothing: products first, then gifts. */
async function take(conn, { products = [], gifts = [] }) {
  const a = await moveProducts(conn, products, -1);
  if (!a.ok) return a;
  const b = await moveGifts(conn, gifts, -1);
  if (!b.ok) { await moveProducts(conn, products, +1); return b; }
  return { ok: true };
}

/** Gives everything back (a cancel, an expired hold, a late payment with stock gone). */
async function giveBack(conn, { products = [], gifts = [] }) {
  await moveProducts(conn, products, +1);
  await moveGifts(conn, gifts, +1);
}

module.exports = { take, giveBack, moveProducts, moveGifts, sizeEntry, sizeEntries, sizesTotal, available, cleanStock, ownStock, mergeStock, oneSizeProduct, ONE_SIZE_NAMES };
