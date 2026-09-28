'use strict';

/**
 * offerPool — the product pool of an offer, and the lock. Contract: features/offer-builder-v2
 * Rules: Docs/OFFER_TERMS_POSTS_RULES.md §1.4 (pool), §1.5 (locking), §1.7 (gifts), §1.12 (lists).
 *
 * Two layers (spec D5):
 *   offer_pool_sources — HOW the brand built the pool. While drafting, the pool is resolved live
 *                        from these: category lines pick up every published product under the node;
 *                        locked products are skipped and counted; duplicates are counted once.
 *   offer_pool_items   — the pool FROZEN at publish, with the days it is locked for. The database
 *                        refuses two items for one product (or gift item) whose days overlap.
 *
 * "Published product" = is_active AND pushed_to_store (spec D16). Every query is brand-scoped.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia } = require('../utils/indiaDay');
const rules = require('./offerRules');

const LIVE = 'bp.is_active = true AND bp.pushed_to_store = true';
const PRODUCT_COLS = `bp.id, bp.name, bp.price, bp.sku, bp.image_url, bp.stock, bp.category_node_id,
  bp.facets->>'brand' AS label_brand, cn.name AS leaf_name`;

const EXPLICIT = new Set(['category_pick', 'search', 'picked']);
const CATEGORY_LIVE = new Set(['category_all', 'category_filter']);

const uuidList = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))] : []);
const money = (n) => (n == null ? null : Number(n));

function productRow(r) {
  return {
    id: r.id, name: r.name, price: money(r.price), sku: r.sku || null, image_url: r.image_url || null,
    stock: r.stock == null ? null : Number(r.stock), leaf_id: r.category_node_id || null,
    leaf_name: r.leaf_name || null, brand_label: r.label_brand || null,
  };
}

/** Every node id under (and including) a node. */
async function subtree(nodeId, tx = db) {
  if (!nodeId) return [];
  const { rows } = await tx.query(
    `WITH RECURSIVE sub AS (
       SELECT id FROM category_nodes WHERE id = $1
       UNION ALL SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id)
     SELECT id FROM sub`, [nodeId]);
  return rows.map((r) => r.id);
}

/** Normalised filters: { leaf_ids, brands, price_min, price_max } */
function cleanFilters(f) {
  const x = f && typeof f === 'object' ? f : {};
  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    leaf_ids: uuidList(x.leaf_ids),
    brands: Array.isArray(x.brands) ? [...new Set(x.brands.map((b) => String(b).trim()).filter(Boolean))] : [],
    price_min: num(x.price_min),
    price_max: num(x.price_max),
  };
}

/**
 * The brand's published products matching a category + filters. Filters combine with AND across
 * kinds and OR within a kind (rules 1.4). Sub-categories are any nodes below the chosen node.
 */
async function productsUnder(brandId, nodeId, filters, tx = db, extra = {}) {
  const nodes = await subtree(nodeId, tx);
  if (!nodes.length) return [];
  const f = cleanFilters(filters);
  const where = [`bp.brand_id = $1`, LIVE, `bp.category_node_id = ANY($2::uuid[])`];
  const params = [brandId, nodes];
  if (f.leaf_ids.length) {
    const sets = [];
    for (const leaf of f.leaf_ids) sets.push(...(await subtree(leaf, tx)));
    params.push([...new Set(sets)]); where.push(`bp.category_node_id = ANY($${params.length}::uuid[])`);
  }
  if (f.brands.length) { params.push(f.brands.map((b) => b.toLowerCase())); where.push(`lower(bp.facets->>'brand') = ANY($${params.length}::text[])`); }
  if (f.price_min != null) { params.push(f.price_min); where.push(`bp.price >= $${params.length}`); }
  if (f.price_max != null) { params.push(f.price_max); where.push(`bp.price <= $${params.length}`); }
  if (extra.q) { params.push(`%${extra.q}%`); where.push(`(bp.name ILIKE $${params.length} OR bp.sku ILIKE $${params.length})`); }
  const { rows } = await tx.query(
    `SELECT ${PRODUCT_COLS} FROM brand_products bp LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
      WHERE ${where.join(' AND ')} ORDER BY bp.name, bp.id`, params);
  return rows.map(productRow);
}

/** The brand's published products by id (unknown, other brands', hidden → dropped). */
async function productsByIds(brandId, ids, tx = db) {
  const list = uuidList(ids);
  if (!list.length) return [];
  const { rows } = await tx.query(
    `SELECT ${PRODUCT_COLS} FROM brand_products bp LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
      WHERE bp.brand_id = $1 AND ${LIVE} AND bp.id = ANY($2::uuid[]) ORDER BY bp.name, bp.id`, [brandId, list]);
  return rows.map(productRow);
}

/** Search the brand's published products by name or SKU. */
async function searchProducts(brandId, q, tx = db) {
  const term = String(q || '').trim();
  if (!term) return [];
  const { rows } = await tx.query(
    `SELECT ${PRODUCT_COLS} FROM brand_products bp LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
      WHERE bp.brand_id = $1 AND ${LIVE} AND (bp.name ILIKE $2 OR bp.sku ILIKE $2)
      ORDER BY bp.name, bp.id LIMIT 200`, [brandId, `%${term}%`]);
  return rows.map(productRow);
}

async function giftItemsByIds(brandId, ids, tx = db) {
  const list = uuidList(ids);
  if (!list.length) return [];
  const { rows } = await tx.query(
    `SELECT id, name, photo_url, value, stock FROM gift_items WHERE brand_id = $1 AND id = ANY($2::uuid[]) ORDER BY name, id`,
    [brandId, list]);
  return rows.map((r) => ({ id: r.id, name: r.name, photo_url: r.photo_url, value: money(r.value), stock: Number(r.stock) }));
}

// ── the lock ─────────────────────────────────────────────────────────────────
/**
 * Which of these products (or gift items) another published offer holds on any day of
 * [startsOn, endsOn]. Map id → { offer_id, offer_name, until }.
 */
async function locksFor({ productIds = [], giftItemIds = [], startsOn, endsOn, exceptOfferId = null }, tx = db) {
  const out = new Map();
  if (!startsOn || !endsOn) return out;
  const pids = uuidList(productIds), gids = uuidList(giftItemIds);
  if (!pids.length && !gids.length) return out;
  const { rows } = await tx.query(
    `SELECT COALESCE(i.product_id, i.gift_item_id) AS id, o.id AS offer_id, o.name AS offer_name,
            (upper(i.lock_days) - 1) AS until
       FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
      WHERE i.removed_at IS NULL AND NOT isempty(i.lock_days)
        AND (i.product_id = ANY($1::uuid[]) OR i.gift_item_id = ANY($2::uuid[]))
        AND ($5::uuid IS NULL OR i.offer_id <> $5)
        AND i.lock_days && daterange($3::date, ($4::date + 1), '[)')
      ORDER BY lower(i.lock_days)`,
    [pids, gids, startsOn, endsOn, exceptOfferId]);
  for (const r of rows) if (!out.has(r.id)) out.set(r.id, { offer_id: r.offer_id, offer_name: r.offer_name, until: calendarDay(r.until) });
  return out;
}

// ── sources ──────────────────────────────────────────────────────────────────
async function nodeName(nodeId, tx = db) {
  if (!nodeId) return null;
  const { rows } = await tx.query(`SELECT name FROM category_nodes WHERE id = $1`, [nodeId]);
  return rows[0] ? rows[0].name : null;
}

async function filterWords(filters, tx = db) {
  const f = cleanFilters(filters);
  const words = [];
  if (f.leaf_ids.length) {
    const { rows } = await tx.query(`SELECT name FROM category_nodes WHERE id = ANY($1::uuid[]) ORDER BY name`, [f.leaf_ids]);
    words.push(rows.map((r) => r.name).join(' or '));
  }
  if (f.brands.length) words.push(f.brands.join(' or '));
  if (f.price_min != null || f.price_max != null) {
    if (f.price_min != null && f.price_max != null) words.push(`${rules.inr(f.price_min)}–${rules.inr(f.price_max)}`);
    else if (f.price_min != null) words.push(`from ${rules.inr(f.price_min)}`);
    else words.push(`up to ${rules.inr(f.price_max)}`);
  }
  return words.filter(Boolean).join(' + ');
}

/** The products a source names or matches (locks not yet considered). */
async function sourceProducts(brandId, src, tx = db) {
  if (src.method === 'category_all') return productsUnder(brandId, src.category_node_id, {}, tx);
  if (src.method === 'category_filter') return productsUnder(brandId, src.category_node_id, src.filters, tx);
  if (EXPLICIT.has(src.method)) return productsByIds(brandId, src.product_ids, tx);
  return [];
}

async function listSources(offerId, tx = db) {
  const { rows } = await tx.query(
    `SELECT * FROM offer_pool_sources WHERE offer_id = $1 ORDER BY created_at, id`, [offerId]);
  return rows;
}

/**
 * Resolve a DRAFT's pool from its sources.
 * @returns {{ buy, gift, sources, locked, conflicts, duplicates, excluded }}
 *   buy:   products in the pool, each with source_id (the first line that brought it)
 *   gift:  [{ kind:'product'|'gift_item', id, name, value, stock?, photo_url? }]
 *   locked: products skipped because another published offer holds them
 *   conflicts: products the brand NAMED (tick / search / put-in-offer) that are now locked
 */
async function resolveDraftPool(offer, tx = db) {
  const sources = await listSources(offer.id, tx);
  const excluded = new Set(offer.excluded_product_ids || []);
  const perSource = [];
  const seen = new Map();     // product id → product (buy)
  const giftSeen = new Map(); // key → gift entry
  let duplicates = 0;

  // Resolve every line first, then ask about locks once.
  const resolved = [];
  for (const s of sources) {
    const products = s.method === 'gift_items' ? [] : await sourceProducts(offer.brand_id, s, tx);
    const giftItems = s.method === 'gift_items' ? await giftItemsByIds(offer.brand_id, s.gift_item_ids, tx) : [];
    resolved.push({ s, products, giftItems });
  }
  const allPids = resolved.flatMap((r) => r.products.map((p) => p.id));
  const allGids = resolved.flatMap((r) => r.giftItems.map((g) => g.id));
  const locks = await locksFor({ productIds: allPids, giftItemIds: allGids, startsOn: calendarDay(offer.starts_on), endsOn: calendarDay(offer.ends_on), exceptOfferId: offer.id }, tx);

  const locked = new Map();
  const conflicts = new Map();
  for (const { s, products, giftItems } of resolved) {
    let count = 0, lockedCount = 0, dup = 0;
    for (const p of products) {
      const lk = locks.get(p.id);
      if (lk) {
        lockedCount += 1;
        locked.set(p.id, { ...p, offer_name: lk.offer_name, until: lk.until });
        if (EXPLICIT.has(s.method) && !excluded.has(p.id)) conflicts.set(p.id, { id: p.id, name: p.name, offer_name: lk.offer_name, ends_on: lk.until });
        continue;
      }
      if (excluded.has(p.id)) continue;
      if (s.pool === 'buy') {
        if (seen.has(p.id)) { dup += 1; duplicates += 1; continue; }
        seen.set(p.id, { ...p, source_id: s.id });
      } else {
        const key = `p:${p.id}`;
        if (giftSeen.has(key)) { dup += 1; duplicates += 1; continue; }
        giftSeen.set(key, { kind: 'product', id: p.id, name: p.name, value: p.price, price: p.price, stock: p.stock, source_id: s.id });
      }
      count += 1;
    }
    for (const g of giftItems) {
      const lk = locks.get(g.id);
      if (lk) {
        lockedCount += 1;
        locked.set(g.id, { id: g.id, name: g.name, offer_name: lk.offer_name, until: lk.until });
        conflicts.set(g.id, { id: g.id, name: g.name, offer_name: lk.offer_name, ends_on: lk.until });
        continue;
      }
      const key = `g:${g.id}`;
      if (giftSeen.has(key)) { dup += 1; duplicates += 1; continue; }
      giftSeen.set(key, { kind: 'gift_item', id: g.id, name: g.name, value: g.value, stock: g.stock, photo_url: g.photo_url, source_id: s.id });
      count += 1;
    }
    perSource.push({ s, count, lockedCount, dup });
  }

  const sourcesOut = [];
  for (const { s, count, lockedCount, dup } of perSource) sourcesOut.push(await describeSource(s, { count, lockedCount, dup }, tx));

  return {
    buy: [...seen.values()],
    gift: [...giftSeen.values()],
    sources: sourcesOut,
    locked: [...locked.values()],
    conflicts: [...conflicts.values()],
    duplicates,
    excluded: excluded.size,
  };
}

/** "Jeans · filters" / "Slim + Levi's + ₹1,500–₹2,500 · 10 products" */
async function describeSource(s, { count, lockedCount, dup }, tx = db) {
  const node = await nodeName(s.category_node_id, tx);
  const n = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
  let label, detail;
  switch (s.method) {
    case 'category_all': label = `${node || 'Category'} · all`; detail = n(count, 'product'); break;
    case 'category_filter': label = `${node || 'Category'} · filters`; detail = `${(await filterWords(s.filters, tx)) || 'no filters'} · ${n(count, 'product')}`; break;
    // Named products: say how many were ticked; the notes say which of them were counted once.
    case 'category_pick': label = `${node || 'Category'} · ticked`; detail = `${n(count + dup, 'product')} ticked`; break;
    case 'search': label = `Search: "${s.query || ''}"`; detail = `${n(count + dup, 'product')} ticked`; break;
    case 'picked': label = 'Picked from Products without offers'; detail = n(count + dup, 'product'); break;
    case 'gift_items': label = 'Gift items'; detail = n(count, 'gift item'); break;
    default: label = s.method; detail = '';
  }
  const notes = [];
  if (dup) notes.push(`${dup} already in pool, counted once`);
  if (lockedCount) notes.push(`${lockedCount} locked and skipped`);
  return {
    id: s.id, pool: s.pool, method: s.method, category_node_id: s.category_node_id,
    filters: s.filters, query: s.query, label, detail: [detail, ...notes].filter(Boolean).join(' · '),
    count, locked: lockedCount, duplicates: dup,
    can_auto_add: CATEGORY_LIVE.has(s.method) && s.pool === 'buy',
  };
}

/** A PUBLISHED offer's frozen pool (removed items left out). */
async function frozenPool(offerId, tx = db) {
  const { rows } = await tx.query(
    `SELECT i.id AS item_id, i.pool, i.product_id, i.gift_item_id, i.quantity, i.gift_limit, i.gifts_given,
            i.price_at_publish, i.added_by, i.added_at, lower(i.lock_days) AS from_day,
            bp.name AS p_name, bp.price AS p_price, bp.image_url AS p_image, bp.sku AS p_sku, bp.stock AS p_stock,
            bp.category_node_id AS p_leaf, cn.name AS p_leaf_name,
            gi.name AS g_name, gi.value AS g_value, gi.stock AS g_stock, gi.photo_url AS g_photo
       FROM offer_pool_items i
       LEFT JOIN brand_products bp ON bp.id = i.product_id
       LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
       LEFT JOIN gift_items gi ON gi.id = i.gift_item_id
      WHERE i.offer_id = $1 AND i.removed_at IS NULL
      ORDER BY i.pool, COALESCE(bp.name, gi.name)`, [offerId]);
  const buy = [], gift = [];
  for (const r of rows) {
    if (r.pool === 'buy') {
      buy.push({ id: r.product_id, name: r.p_name, price: money(r.p_price), image_url: r.p_image, sku: r.p_sku,
        stock: r.p_stock == null ? null : Number(r.p_stock), leaf_id: r.p_leaf, leaf_name: r.p_leaf_name,
        quantity: Number(r.quantity), added_by: r.added_by, from_day: calendarDay(r.from_day) });
    } else if (r.product_id) {
      gift.push({ kind: 'product', id: r.product_id, name: r.p_name, value: money(r.p_price), price: money(r.p_price),
        stock: r.p_stock == null ? null : Number(r.p_stock), gift_limit: r.gift_limit, gifts_given: Number(r.gifts_given) });
    } else {
      gift.push({ kind: 'gift_item', id: r.gift_item_id, name: r.g_name, value: money(r.g_value), stock: Number(r.g_stock),
        photo_url: r.g_photo, gifts_given: Number(r.gifts_given) });
    }
  }
  return { buy, gift };
}

// ── adding a line to a draft's pool ──────────────────────────────────────────
const METHODS_FOR_POOL = {
  buy: ['category_all', 'category_pick', 'category_filter', 'search', 'picked'],
  gift: ['category_pick', 'search', 'picked', 'gift_items'],
};

/**
 * Validates and stores one pool line on a draft. Returns the new source row.
 * Refuses (422): no dates yet, a method the pool doesn't take, products that aren't the brand's
 * published products, a pick-any bundle reaching into a second category, a fixed bundle line that
 * isn't exact products, a free-gift-only pool on another kind of offer.
 */
async function addSource(offer, body, tx = db) {
  if (!offer.starts_on || !offer.ends_on) {
    throw new AppError('VALIDATION_ERROR', 'Set the offer\'s dates first. They decide which products are locked.', 422, 'starts_on');
  }
  const pool = body.pool === 'gift' ? 'gift' : 'buy';
  const method = String(body.method || '');
  if (pool === 'gift' && offer.offer_type !== 'free_gift') {
    throw new AppError('VALIDATION_ERROR', 'Only a free gift offer has a gift pool.', 422, 'pool');
  }
  if (!METHODS_FOR_POOL[pool].includes(method)) {
    throw new AppError('VALIDATION_ERROR', pool === 'gift'
      ? 'Gifts are picked one by one: tick them, search for them, or choose gift items.'
      : 'Unknown way of adding products.', 422, 'method');
  }
  if (offer.sub_type === 'fixed' && CATEGORY_LIVE.has(method)) {
    throw new AppError('VALIDATION_ERROR', 'A fixed bundle takes exact products. Search for them and tick each one.', 422, 'method');
  }

  const row = { pool, method, category_node_id: null, filters: {}, query: null, product_ids: [], gift_item_ids: [] };
  if (method === 'category_all' || method === 'category_filter' || method === 'category_pick') {
    const nodeId = body.category_node_id;
    const { rows } = await tx.query(`SELECT id FROM category_nodes WHERE id = $1`, [nodeId || null]);
    if (!rows[0]) throw new AppError('VALIDATION_ERROR', 'Choose a category.', 422, 'category_node_id');
    row.category_node_id = nodeId;
  }
  if (method === 'category_filter') {
    row.filters = cleanFilters(body.filters);
    const f = row.filters;
    if (!f.leaf_ids.length && !f.brands.length && f.price_min == null && f.price_max == null) {
      throw new AppError('VALIDATION_ERROR', 'Add at least one filter, or use "All products".', 422, 'filters');
    }
    if (f.price_min != null && f.price_max != null && f.price_max < f.price_min) {
      throw new AppError('VALIDATION_ERROR', 'The price range ends below where it starts.', 422, 'filters');
    }
  }
  if (EXPLICIT.has(method)) {
    const ids = uuidList(body.product_ids);
    if (!ids.length) throw new AppError('VALIDATION_ERROR', 'Tick at least one product.', 422, 'product_ids');
    const found = await productsByIds(offer.brand_id, ids, tx);
    if (found.length !== ids.length) throw new AppError('VALIDATION_ERROR', 'One or more products are not in your published listings.', 422, 'product_ids');
    if (method === 'category_pick') {
      const under = new Set(await subtree(row.category_node_id, tx));
      if (found.some((p) => !under.has(p.leaf_id))) throw new AppError('VALIDATION_ERROR', 'A ticked product is not in this category.', 422, 'product_ids');
    }
    // A product a brand names must not be locked right now (rules 1.4: locked ones can't be added).
    const locks = await locksFor({ productIds: ids, startsOn: calendarDay(offer.starts_on), endsOn: calendarDay(offer.ends_on), exceptOfferId: offer.id }, tx);
    const first = found.find((p) => locks.has(p.id));
    if (first) {
      const lk = locks.get(first.id);
      throw new AppError('PRODUCT_LOCKED', `"${first.name}" is in "${lk.offer_name}" until ${rules.dayMonth(lk.until)} and can't be added.`, 409, 'product_ids');
    }
    row.product_ids = ids;
    if (method === 'search') row.query = String(body.query || '').trim().slice(0, 120) || null;
  }
  if (method === 'gift_items') {
    const ids = uuidList(body.gift_item_ids);
    if (!ids.length) throw new AppError('VALIDATION_ERROR', 'Tick at least one gift item.', 422, 'gift_item_ids');
    const found = await giftItemsByIds(offer.brand_id, ids, tx);
    if (found.length !== ids.length) throw new AppError('VALIDATION_ERROR', 'One or more gift items are not yours.', 422, 'gift_item_ids');
    const locks = await locksFor({ giftItemIds: ids, startsOn: calendarDay(offer.starts_on), endsOn: calendarDay(offer.ends_on), exceptOfferId: offer.id }, tx);
    const first = found.find((g) => locks.has(g.id));
    if (first) {
      const lk = locks.get(first.id);
      throw new AppError('PRODUCT_LOCKED', `"${first.name}" is in "${lk.offer_name}" until ${rules.dayMonth(lk.until)} and can't be added.`, 409, 'gift_item_ids');
    }
    row.gift_item_ids = ids;
  }

  // Pick-any bundles stay in one category (rules 1.6). Check the pool as it would be.
  if (offer.sub_type === 'pick_any' && pool === 'buy') {
    const before = await resolveDraftPool(offer, tx);
    const incoming = (await sourceProducts(offer.brand_id, row, tx)).filter((p) => !(offer.excluded_product_ids || []).includes(p.id));
    const leafOf = new Map(before.buy.map((p) => [p.leaf_id, p.leaf_name]));
    const baseLeaf = before.buy.length ? before.buy[0].leaf_id : (incoming[0] && incoming[0].leaf_id);
    const baseName = before.buy.length ? before.buy[0].leaf_name : (incoming[0] && incoming[0].leaf_name);
    const stray = incoming.find((p) => p.leaf_id !== baseLeaf);
    if (stray || leafOf.size > 1) {
      throw new AppError('VALIDATION_ERROR',
        `Only products from one category can be added. You tried to add "${(stray || incoming[0]).name}". Pick-any bundles stay in one category (${baseName}). For several categories, go back and choose Mix & match.`,
        422, 'category_node_id');
    }
  }

  const { rows } = await tx.query(
    `INSERT INTO offer_pool_sources (offer_id, pool, method, category_node_id, filters, query, product_ids, gift_item_ids)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::uuid[],$8::uuid[]) RETURNING *`,
    [offer.id, row.pool, row.method, row.category_node_id, JSON.stringify(row.filters), row.query, row.product_ids, row.gift_item_ids]);
  // Adding a product back by name takes it off the "taken out" list.
  if (row.product_ids.length && (offer.excluded_product_ids || []).length) {
    await tx.query(
      `UPDATE brand_offers SET excluded_product_ids = ARRAY(SELECT unnest(excluded_product_ids) EXCEPT SELECT unnest($2::uuid[])), updated_at = now() WHERE id = $1`,
      [offer.id, row.product_ids]);
  }
  return rows[0];
}

// ── browsing (the left side of the pool builder) ────────────────────────────
/**
 * Products a brand can see while building the pool, each marked locked (with the other offer and
 * its end) and in-pool. `node` + filters, or `q` for search.
 */
async function candidates(offer, { node, filters, q }, tx = db) {
  let products;
  if (q) products = await searchProducts(offer.brand_id, q, tx);
  else if (node) products = await productsUnder(offer.brand_id, node, filters || {}, tx);
  else products = [];
  const locks = await locksFor({ productIds: products.map((p) => p.id), startsOn: calendarDay(offer.starts_on), endsOn: calendarDay(offer.ends_on), exceptOfferId: offer.id }, tx);
  const pool = offer.status === 'draft' ? await resolveDraftPool(offer, tx) : await frozenPool(offer.id, tx);
  const inBuy = new Set(pool.buy.map((p) => p.id));
  const inGift = new Set(pool.gift.filter((g) => g.kind === 'product').map((g) => g.id));
  return products.map((p) => {
    const lk = locks.get(p.id);
    return { ...p, locked: lk ? { offer_name: lk.offer_name, until: lk.until } : null, in_pool: inBuy.has(p.id) ? 'buy' : (inGift.has(p.id) ? 'gift' : null) };
  });
}

async function giftItemCandidates(offer, tx = db) {
  const { rows } = await tx.query(`SELECT id, name, photo_url, value, stock FROM gift_items WHERE brand_id = $1 ORDER BY name, id`, [offer.brand_id]);
  const locks = await locksFor({ giftItemIds: rows.map((r) => r.id), startsOn: calendarDay(offer.starts_on), endsOn: calendarDay(offer.ends_on), exceptOfferId: offer.id }, tx);
  return rows.map((r) => {
    const lk = locks.get(r.id);
    return { id: r.id, name: r.name, photo_url: r.photo_url, value: money(r.value), stock: Number(r.stock), locked: lk ? { offer_name: lk.offer_name, until: lk.until } : null };
  });
}

/** What the filter chips can offer under a node: sub-categories, brand labels, the price span. */
async function filterOptions(brandId, nodeId, tx = db) {
  const nodes = await subtree(nodeId, tx);
  if (!nodes.length) throw new AppError('NOT_FOUND', 'Category not found', 404);
  const { rows: subs } = await tx.query(
    `SELECT cn.id, cn.name, cn.is_leaf, count(bp.id)::int AS products
       FROM category_nodes cn
       LEFT JOIN brand_products bp ON bp.category_node_id = cn.id AND bp.brand_id = $2 AND ${LIVE}
      WHERE cn.id = ANY($1::uuid[]) AND cn.id <> $3
      GROUP BY cn.id, cn.name, cn.is_leaf, cn.sort_order ORDER BY cn.sort_order, cn.name`, [nodes, brandId, nodeId]);
  const { rows: brands } = await tx.query(
    `SELECT DISTINCT bp.facets->>'brand' AS brand FROM brand_products bp
      WHERE bp.brand_id = $1 AND ${LIVE} AND bp.category_node_id = ANY($2::uuid[]) AND COALESCE(bp.facets->>'brand','') <> ''
      ORDER BY 1`, [brandId, nodes]);
  const { rows: span } = await tx.query(
    `SELECT min(bp.price) AS lo, max(bp.price) AS hi, count(*)::int AS n FROM brand_products bp
      WHERE bp.brand_id = $1 AND ${LIVE} AND bp.category_node_id = ANY($2::uuid[])`, [brandId, nodes]);
  return {
    sub_categories: subs.filter((s) => s.products > 0 || s.is_leaf).map((s) => ({ id: s.id, name: s.name, products: s.products })),
    brands: brands.map((b) => b.brand),
    price: { min: money(span[0].lo), max: money(span[0].hi) },
    products: span[0].n,
  };
}

// ── Listings: products without offers, and the offer per product ─────────────
/**
 * Published products not in any offer on `day` (rules 1.12), with the next offer they're booked into
 * and the last one they were in. `mode: 'on_or_after'` is Level 2's reading (rules 2.4): not held
 * on that day or any day after it.
 */
async function productsWithoutOffers(brandId, { day, q, node, price_min, price_max, mode = 'on' } = {}, tx = db) {
  const d = day || todayInIndia();
  const where = [`bp.brand_id = $1`, LIVE];
  const params = [brandId, d];
  const heldOn = mode === 'on_or_after'
    ? `i.lock_days && daterange($2::date, NULL, '[)')`
    : `i.lock_days @> $2::date`;
  where.push(`NOT EXISTS (SELECT 1 FROM offer_pool_items i WHERE i.product_id = bp.id AND i.removed_at IS NULL AND ${heldOn})`);
  if (q) { params.push(`%${q}%`); where.push(`(bp.name ILIKE $${params.length} OR bp.sku ILIKE $${params.length})`); }
  if (node) { params.push(await subtree(node, tx)); where.push(`bp.category_node_id = ANY($${params.length}::uuid[])`); }
  if (price_min != null && price_min !== '') { params.push(Number(price_min)); where.push(`bp.price >= $${params.length}`); }
  if (price_max != null && price_max !== '') { params.push(Number(price_max)); where.push(`bp.price <= $${params.length}`); }
  const { rows } = await tx.query(
    `SELECT ${PRODUCT_COLS},
            (SELECT CASE WHEN p.name IS NULL THEN NULL ELSE p.name || ' › ' END FROM category_nodes p WHERE p.id = cn.parent_id) AS parent_prefix,
            nx.offer_name AS next_offer, nx.from_day AS next_from,
            ls.offer_name AS last_offer, ls.until AS last_until
       FROM brand_products bp
       LEFT JOIN category_nodes cn ON cn.id = bp.category_node_id
       LEFT JOIN LATERAL (
         SELECT o.name AS offer_name, lower(i.lock_days) AS from_day FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
          WHERE i.product_id = bp.id AND i.removed_at IS NULL AND NOT isempty(i.lock_days) AND lower(i.lock_days) > $2::date
          ORDER BY lower(i.lock_days) LIMIT 1) nx ON true
       LEFT JOIN LATERAL (
         SELECT o.name AS offer_name,
                CASE WHEN o.status = 'ended' AND o.ended_at IS NOT NULL THEN (o.ended_at AT TIME ZONE 'Asia/Kolkata')::date
                     ELSE (upper(i.lock_days) - 1) END AS until
           FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
          WHERE i.product_id = bp.id AND i.removed_at IS NULL AND NOT isempty(i.lock_days) AND upper(i.lock_days) <= $2::date
          ORDER BY upper(i.lock_days) DESC LIMIT 1) ls ON true
      WHERE ${where.join(' AND ')}
      ORDER BY bp.name, bp.id`, params);
  return rows.map((r) => ({
    ...productRow(r),
    category_path: [r.parent_prefix, r.leaf_name].filter(Boolean).join(''),
    next_offer: r.next_offer ? { name: r.next_offer, from: calendarDay(r.next_from) } : null,
    last_offer: r.last_offer ? { name: r.last_offer, until: calendarDay(r.last_until) } : null,
  }));
}

/** For every product of the brand: the offer holding it today, and the next one booked. */
async function offersByProduct(brandId, { productIds = null, today = todayInIndia() } = {}, tx = db) {
  const params = [brandId, today];
  let filter = '';
  if (productIds) { params.push(uuidList(productIds)); filter = `AND i.product_id = ANY($3::uuid[])`; }
  const { rows } = await tx.query(
    `SELECT i.product_id, o.id AS offer_id, o.name, o.offer_type, o.sub_type, i.pool,
            lower(i.lock_days) AS from_day, (upper(i.lock_days) - 1) AS until,
            (i.lock_days @> $2::date) AS is_now
       FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
      WHERE i.brand_id = $1 AND i.removed_at IS NULL AND i.product_id IS NOT NULL AND NOT isempty(i.lock_days)
        AND upper(i.lock_days) > $2::date ${filter}
      ORDER BY lower(i.lock_days)`, params);
  const out = {};
  for (const r of rows) {
    const e = out[r.product_id] || (out[r.product_id] = { now: null, next: null });
    const v = { offer_id: r.offer_id, name: r.name, type_label: rules.typeLabel(r.offer_type, r.sub_type), pool: r.pool, from: calendarDay(r.from_day), until: calendarDay(r.until) };
    if (r.is_now && !e.now) e.now = v;
    else if (!r.is_now && !e.next) e.next = v;
  }
  return out;
}

module.exports = {
  LIVE, subtree, cleanFilters, productsUnder, productsByIds, searchProducts, giftItemsByIds,
  locksFor, listSources, resolveDraftPool, frozenPool, addSource, describeSource,
  candidates, giftItemCandidates, filterOptions, productsWithoutOffers, offersByProduct,
  EXPLICIT, CATEGORY_LIVE,
};
