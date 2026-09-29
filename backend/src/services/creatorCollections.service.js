'use strict';

/**
 * creatorCollections.service.js — her own collections (Level 3, rules 4.11, founder Q5).
 * Contract: features/shoppable-posts-v2 · boards P16–P20 · spec D17
 *
 * A collection is a name plus EITHER her posts OR products — nothing more. It can mix brands and
 * needs no INFLX approval. Posts must be approved and in the shop when added; products come from
 * what her collaborations let her sell, and each remembers the collaboration it came from, because
 * that decides its offer and her commission (M6). A collection is hidden from shoppers when
 * nothing in it is still in the shop; deleting one never touches the posts in it.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const posts = require('./shoppablePosts.service');
const terms = require('./creatorTerms.service');
const rules = require('./offerRules');
const { todayInIndia } = require('../utils/indiaDay');

const MSG = {
  NAME: 'Give the collection a name.',
  NAME_LONG: 'Keep the name under 60 characters.',
  KIND: 'Choose posts or products.',
  EMPTY: (kind) => `Pick at least one ${kind === 'posts' ? 'post' : 'product'}.`,
  POST_NOT_LIVE: 'Only your posts that are in the shop can go in a collection.',
  PRODUCT_NOT_YOURS: "A product isn't one you can sell any more.",
  WRONG_KIND: (kind) => `This collection holds ${kind} only.`,
};

/** P19: '₹1,899 with 20% off' — the short form of a discount. */
function shortDiscount(offer) {
  const c = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
  if (offer.sub_type === 'percentage' && c.pct != null) return `${c.pct}% off`;
  if (offer.sub_type === 'flat' && c.amount != null) return `${rules.inr(c.amount)} off`;
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (m, field = null) => new AppError('VALIDATION_ERROR', m, 422, field);
const notFound = () => new AppError('NOT_FOUND', 'Not found', 404);

function cleanName(raw) {
  const name = String(raw || '').trim();
  if (!name) throw bad(MSG.NAME, 'name');
  if (name.length > 60) throw bad(MSG.NAME_LONG, 'name');
  return name;
}

/** Her posts that can go in a collection: approved and in the shop (live or before its date). */
async function livePosts(influencerId) {
  const { posts: all } = await posts.listMine(influencerId);
  return all.filter((p) => p.state === 'live' || p.state === 'approved');
}

/** Products she can sell, by collaboration, with the price a shopper pays and whether an offer applies. */
async function sellableProducts(influencerId) {
  const collabs = await posts.myCollabs(influencerId);
  const out = [];
  for (const ci of collabs) {
    const ids = await terms.sellableProductIds(ci.id);
    if (!ids.length) continue;
    const { rows } = await db.query(
      `SELECT bp.id, bp.name, bp.price, bp.image_url FROM brand_products bp WHERE bp.id = ANY($1::uuid[]) ORDER BY bp.name`, [ids]);
    const { rows: offers } = await db.query(
      `SELECT i.product_id, o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json
         FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
         JOIN offer_pool_items i ON i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL
        WHERE co.campaign_influencer_id = $1 AND co.dropped_at IS NULL AND o.status = 'published' AND o.ends_on >= $2::date`,
      [ci.id, todayInIndia()]);
    const offerOf = new Map(offers.map((o) => [o.product_id, o]));
    out.push({
      campaign_influencer_id: ci.id, brand_name: ci.brand_name, campaign_name: ci.campaign_name, set_name: ci.set_name,
      products: rows.map((r) => {
        const o = offerOf.get(r.id);
        const shaped = o ? { offer_type: o.offer_type, sub_type: o.sub_type, offer_config_json: o.offer_config_json || {} } : null;
        const pays = posts.shopperPrice(shaped, r.price);
        return {
          id: r.id, name: r.name, image_url: r.image_url, price: Number(r.price), shopper_price: pays,
          line: o ? (o.offer_type === 'discount' ? `${rules.inr(pays)} with ${shortDiscount(shaped) || o.name}` : `${rules.inr(r.price)} · ${o.name}`)
            : `${rules.inr(r.price)} · normal price`,
        };
      }),
    });
  }
  return out;
}

/** P18 / P19 — what she can put in. */
async function options(influencerId, kind) {
  if (kind === 'posts') return { kind, posts: (await livePosts(influencerId)).map(postCard) };
  if (kind === 'products') return { kind, groups: await sellableProducts(influencerId) };
  throw bad(MSG.KIND, 'kind');
}

function postCard(p) {
  return { id: p.id, title: p.title, brand_name: p.collaboration.brand_name,
    line: p.kind === 'offer' && p.offer ? `${p.offer.type}` : (p.facets.price_band || 'Price post'),
    cover: p.media[0] ? p.media[0].url : null, state: p.state };
}

async function checkItems(influencerId, kind, items) {
  if (!Array.isArray(items) || !items.length) throw bad(MSG.EMPTY(kind), 'items');
  if (kind === 'posts') {
    const live = new Set((await livePosts(influencerId)).map((p) => p.id));
    const ids = [...new Set(items.map((x) => String(x.post_id || x)))];
    if (ids.some((id) => !live.has(id))) throw bad(MSG.POST_NOT_LIVE, 'items');
    return ids.map((id) => ({ post_id: id }));
  }
  const groups = await sellableProducts(influencerId);
  const ok = new Set();
  for (const g of groups) for (const p of g.products) ok.add(`${g.campaign_influencer_id}:${p.id}`);
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const key = `${x && x.campaign_influencer_id}:${x && x.product_id}`;
    if (!ok.has(key)) throw bad(MSG.PRODUCT_NOT_YOURS, 'items');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ product_id: x.product_id, campaign_influencer_id: x.campaign_influencer_id });
  }
  return out;
}

async function own(influencerId, id) {
  if (!UUID.test(String(id || ''))) throw notFound();
  const { rows } = await db.query(`SELECT * FROM creator_collections WHERE id = $1 AND influencer_id = $2`, [id, influencerId]);
  if (!rows[0]) throw notFound();
  return rows[0];
}

async function create(influencerId, { name, kind, items } = {}) {
  const n = cleanName(name);
  if (!['posts', 'products'].includes(kind)) throw bad(MSG.KIND, 'kind');
  const list = await checkItems(influencerId, kind, items);
  const id = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(`INSERT INTO creator_collections (influencer_id, name, kind) VALUES ($1, $2, $3) RETURNING id`, [influencerId, n, kind]);
    await insertItems(tx, rows[0].id, list, 0);
    return rows[0].id;
  });
  return get(influencerId, id);
}

async function insertItems(tx, collectionId, list, start) {
  let i = start;
  for (const x of list) {
    await tx.query(
      `INSERT INTO creator_collection_items (collection_id, post_id, product_id, campaign_influencer_id, sort_order)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [collectionId, x.post_id || null, x.product_id || null, x.campaign_influencer_id || null, i]);
    i += 1;
  }
}

/** One collection with every item; an item that left the shop stays, greyed, for her (P20). */
async function shapeOne(c, { postsById, productsLive, sales }) {
  const { rows: items } = await db.query(
    `SELECT cci.id, cci.post_id, cci.product_id, cci.campaign_influencer_id, bp.name AS product_name, bp.price, bp.image_url,
            b.business_name AS brand_name, cp.influencer_id AS post_owner
       FROM creator_collection_items cci
       LEFT JOIN brand_products bp ON bp.id = cci.product_id
       LEFT JOIN brands b ON b.id = bp.brand_id
       LEFT JOIN creator_posts cp ON cp.id = cci.post_id
      WHERE cci.collection_id = $1 ORDER BY cci.sort_order, cci.added_at`, [c.id]);
  const shaped = items.map((it) => {
    if (it.post_id) {
      const p = postsById.get(it.post_id);
      const inShop = !!p && (p.state === 'live' || p.state === 'approved');
      return { id: it.id, kind: 'post', post_id: it.post_id, title: p ? p.title : 'Post', brand_name: p ? p.collaboration.brand_name : null,
        line: !p ? null : inShop ? (p.offer ? p.offer.type : (p.facets.price_band || 'Price post')) : `Left the shop${p.removed && p.removed.at ? ` ${rules.dayMonth(String(p.removed.at).slice(0, 10))}` : ''}`,
        in_shop: inShop, cover: p && p.media[0] ? p.media[0].url : null };
    }
    const live = productsLive.has(`${it.campaign_influencer_id}:${it.product_id}`);
    return { id: it.id, kind: 'product', product_id: it.product_id, campaign_influencer_id: it.campaign_influencer_id,
      title: it.product_name, brand_name: it.brand_name, price: it.price == null ? null : Number(it.price), image_url: it.image_url,
      in_shop: live, line: live ? null : 'Not on sale any more' };
  });
  const inShop = shaped.filter((x) => x.in_shop).length;
  const brands = [...new Set(shaped.map((x) => x.brand_name).filter(Boolean))];
  const s = sales.get(c.id) || { orders: 0, commission: 0 };
  return {
    id: c.id, name: c.name, kind: c.kind, items: shaped, count: shaped.length, in_shop: inShop,
    brands, hidden: inShop === 0,
    line: c.kind === 'posts'
      ? `${shaped.length} post${shaped.length === 1 ? '' : 's'} · ${brands.join(', ') || '—'}`
      : `${shaped.length} product${shaped.length === 1 ? '' : 's'} · ${brands.length} brand${brands.length === 1 ? '' : 's'}`,
    hidden_line: inShop === 0 ? `0 of ${shaped.length} ${c.kind === 'posts' ? 'posts' : 'products'} still in the shop` : null,
    sales: s, sales_words: s.orders ? `${s.orders} sale${s.orders > 1 ? 's' : ''} · ${rules.inr(s.commission)} to you` : 'No sales yet',
    updated_at: c.updated_at,
  };
}

async function context(influencerId) {
  const { posts: all } = await posts.listMine(influencerId);
  const postsById = new Map(all.map((p) => [p.id, p]));
  const productsLive = new Set();
  for (const ci of await posts.myCollabs(influencerId)) {
    for (const id of await terms.sellableProductIds(ci.id)) productsLive.add(`${ci.id}:${id}`);
  }
  // Sales through a collection arrive with the shopper app (D18): none can happen yet.
  return { postsById, productsLive, sales: new Map() };
}

async function list(influencerId) {
  const { rows } = await db.query(`SELECT * FROM creator_collections WHERE influencer_id = $1 ORDER BY updated_at DESC`, [influencerId]);
  const ctx = await context(influencerId);
  const out = [];
  for (const c of rows) out.push(await shapeOne(c, ctx));
  return { collections: out };
}

async function get(influencerId, id) {
  const c = await own(influencerId, id);
  return shapeOne(c, await context(influencerId));
}

/** Rename, add items, remove items (P20). A collection keeps its kind. */
async function update(influencerId, id, { name, add, remove } = {}) {
  const c = await own(influencerId, id);
  await db.withTransaction(async (tx) => {
    if (name !== undefined) await tx.query(`UPDATE creator_collections SET name = $2 WHERE id = $1`, [c.id, cleanName(name)]);
    if (Array.isArray(add) && add.length) {
      const list = await checkItems(influencerId, c.kind, add);
      const { rows: [m] } = await tx.query(`SELECT COALESCE(max(sort_order), -1) + 1 AS n FROM creator_collection_items WHERE collection_id = $1`, [c.id]);
      await insertItems(tx, c.id, list, m.n);
    }
    if (Array.isArray(remove) && remove.length) {
      await tx.query(`DELETE FROM creator_collection_items WHERE collection_id = $1 AND id = ANY($2::uuid[])`,
        [c.id, remove.filter((x) => UUID.test(String(x)))]);
    }
    await tx.query(`UPDATE creator_collections SET updated_at = now() WHERE id = $1`, [c.id]);
  });
  return get(influencerId, c.id);
}

/** Deleting never touches the posts in it (Q5). */
async function remove(influencerId, id) {
  const c = await own(influencerId, id);
  await db.query(`DELETE FROM creator_collections WHERE id = $1`, [c.id]);
  return { deleted: true };
}

module.exports = { MSG, options, create, list, get, update, remove };
