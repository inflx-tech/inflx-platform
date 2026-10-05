'use strict';

/**
 * shopperStores.service.js — the creator store, the brand store, the brand's Offers page and a
 * creator's collections, as a shopper sees them (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F7–F10 · rules v1.7 §5.9, §5.10, §4.11, §4.13, M6
 *
 * Both stores are made only of live posts (P1, 4.13). Circles show only brands, creators and
 * categories that lead to something live. An offer is listed only while a live post carries it,
 * and tapping it shows those posts: every purchase goes through a post.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia } = require('../utils/indiaDay');
const rules = require('./offerRules');
const posts = require('./shoppablePosts.service');
const sp = require('./shopperPosts.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 20;
const notFound = () => new AppError('NOT_FOUND', 'Not found', 404);
const OFFER_TYPES = [
  { key: 'bogo', label: 'BOGO' }, { key: 'bundle', label: 'Bundle' }, { key: 'discount', label: 'Discount' },
  { key: 'volume', label: 'Buy more save more' }, { key: 'free_gift', label: 'Free gift' },
];

/** Leaf categories a set of posts spans, most-used first: [{ id, name, posts }]. */
async function categoriesOf(pool) {
  const count = new Map();
  for (const p of pool) for (const l of p.category_node_ids || []) count.set(l, (count.get(l) || 0) + 1);
  if (!count.size) return [];
  const { rows } = await db.query(`SELECT id, name FROM category_nodes WHERE id = ANY($1::uuid[])`, [[...count.keys()]]);
  return rows.map((r) => ({ id: r.id, name: r.name, posts: count.get(r.id) })).sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name));
}

async function creatorIdOf(idOrHandle) {
  const raw = String(idOrHandle || '').trim();
  if (UUID.test(raw)) return raw;
  const h = raw.replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,60}$/.test(h)) return null;
  const { rows } = await db.query(
    `SELECT id FROM (SELECT i.id, 0 AS rank FROM influencers i WHERE lower(regexp_replace(i.instagram_handle, '^@', '')) = $1
                     UNION ALL SELECT sh.influencer_id, 1 FROM store_handles sh WHERE sh.handle = $1) x ORDER BY rank LIMIT 1`, [h]);
  return rows[0] ? rows[0].id : null;
}

/* ───────────────────────────────────────────── F7 · F8 the creator store */

async function creatorStore(idOrHandle, who) {
  const id = await creatorIdOf(idOrHandle);
  if (!id) throw notFound();
  const { rows } = await db.query(`SELECT i.id, i.bio FROM influencers i WHERE i.id = $1`, [id]);
  if (!rows[0]) throw notFound();
  const creator = (await sp.creatorsById([id])).get(id);
  const pool = await sp.livePool({ influencerId: id });
  const { rows: [f] } = await db.query(`SELECT count(*)::int AS n FROM follower_follows WHERE influencer_id = $1`, [id]);
  let following = (who.follows || []).includes(id);
  if (who.followerId) {
    const { rows: me } = await db.query(`SELECT 1 FROM follower_follows WHERE follower_id = $1 AND influencer_id = $2`, [who.followerId, id]);
    following = following || !!me[0];
  }
  const brandIds = [...new Set(pool.map((p) => p.brand_id))];
  const brands = await sp.brandsById(brandIds);
  const collections = await collectionsOf(id);
  return {
    creator: { ...creator, bio: rows[0].bio || null },
    followers: f.n, following,
    brands: brandIds.map((b) => brands.get(b)).filter(Boolean),
    categories: await categoriesOf(pool),
    tabs: { posts: pool.length, videos: pool.filter((p) => p.media_kind === 'video').length, collections: collections.length },
  };
}

/** Posts tab (photos and videos) or Videos tab, newest first, optionally one category. */
async function creatorPosts(idOrHandle, who, { tab = 'posts', category = null, offset = 0 } = {}) {
  const id = await creatorIdOf(idOrHandle);
  if (!id) throw notFound();
  const pool = await sp.livePool({ influencerId: id, videosOnly: tab === 'videos', leafId: UUID.test(String(category || '')) ? category : null });
  const start = Math.max(0, Number(offset) || 0);
  return { posts: await sp.cards(pool.slice(start, start + PAGE).map((p) => p.id), who), more: pool.length > start + PAGE, next: start + PAGE };
}

/** Her collections a shopper can open: never a hidden one (nothing in it is in the shop, 4.11). */
async function collectionsOf(influencerId) {
  const { rows } = await db.query(`SELECT id FROM creator_collections WHERE influencer_id = $1 ORDER BY updated_at DESC`, [influencerId]);
  const out = [];
  for (const r of rows) {
    const c = await collection(r.id, {}, { cardsToo: false });
    if (c && !c.hidden) out.push({ id: c.id, name: c.name, kind: c.kind, count: c.count, cover: c.cover });
  }
  return out;
}

async function creatorCollections(idOrHandle) {
  const id = await creatorIdOf(idOrHandle);
  if (!id) throw notFound();
  return { collections: await collectionsOf(id) };
}

/** The running offer a collaboration gives this product, if any (M6: the item's own offer). */
async function productOffers(pairs, today = todayInIndia()) {
  const out = new Map();
  if (!pairs.length) return out;
  const { rows } = await db.query(
    `SELECT co.campaign_influencer_id, i.product_id, o.id, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.ends_on
       FROM collab_offers co JOIN brand_offers o ON o.id = co.offer_id
       JOIN offer_pool_items i ON i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL
      WHERE co.campaign_influencer_id = ANY($1::uuid[]) AND i.product_id = ANY($2::uuid[]) AND co.dropped_at IS NULL
        AND o.status = 'published' AND o.starts_on <= $3::date AND o.ends_on >= $3::date`,
    [[...new Set(pairs.map((x) => x.ci))], [...new Set(pairs.map((x) => x.product))], today]);
  for (const r of rows) out.set(`${r.campaign_influencer_id}:${r.product_id}`, r);
  return out;
}

/** Whether a collaboration still lets her sell a product (M6), for many at once. */
async function sellable(pairs) {
  const ok = new Set();
  const terms = require('./creatorTerms.service');
  for (const ci of [...new Set(pairs.map((x) => x.ci))]) {
    for (const pid of await terms.sellableProductIds(ci)) ok.add(`${ci}:${pid}`);
  }
  return ok;
}

/** A collection as a shopper opens it: posts as tiles, or products as rows each with its own offer (F8). */
async function collection(idOrCode, who = {}, { cardsToo = true } = {}) {
  const raw = String(idOrCode || '').trim();
  const { rows } = await db.query(
    UUID.test(raw) ? `SELECT * FROM creator_collections WHERE id = $1` : `SELECT * FROM creator_collections WHERE link_code = upper($1)`, [raw]);
  const c = rows[0];
  if (!c) return null;
  const { rows: items } = await db.query(
    `SELECT cci.id, cci.post_id, cci.product_id, cci.campaign_influencer_id, bp.name, bp.price, bp.image_url, bp.stock,
            bp.is_active, bp.pushed_to_store, b.id AS brand_id, b.business_name AS brand_name
       FROM creator_collection_items cci
       LEFT JOIN brand_products bp ON bp.id = cci.product_id LEFT JOIN brands b ON b.id = bp.brand_id
      WHERE cci.collection_id = $1 ORDER BY cci.sort_order, cci.added_at`, [c.id]);
  let postIds = [];
  let products = [];
  if (c.kind === 'posts') {
    const live = await sp.livePool({ ids: items.map((x) => x.post_id).filter(Boolean) });
    const liveIds = new Set(live.map((p) => p.id));
    postIds = items.map((x) => x.post_id).filter((id) => liveIds.has(id));
  } else {
    const pairs = items.map((x) => ({ ci: x.campaign_influencer_id, product: x.product_id }));
    const [offers, ok] = await Promise.all([productOffers(pairs), sellable(pairs)]);
    // shopper-app-fixes (F14): a signed-in shopper's hearts — the phone showed them only for a guest.
    const hearted = new Set(who && who.followerId
      ? (await db.query(`SELECT product_id FROM follower_wishlist_items WHERE follower_id = $1`, [who.followerId])).rows.map((r) => r.product_id) : []);
    products = items.filter((x) => ok.has(`${x.campaign_influencer_id}:${x.product_id}`) && x.is_active && x.pushed_to_store
      && (x.stock == null || Number(x.stock) > 0)).map((x) => {
      const o = offers.get(`${x.campaign_influencer_id}:${x.product_id}`) || null;
      const pays = posts.shopperPrice(o, x.price);
      return {
        collection_item_id: x.id, id: x.product_id, name: x.name, image_url: x.image_url, brand: { id: x.brand_id, name: x.brand_name },
        price: Number(x.price), shopper_price: pays, struck: pays < Number(x.price),
        saved: hearted.has(x.product_id),
        offer: o ? { id: o.id, badge: sp.badgeOf(o), line: sp.appliedLine(o), ends_on: calendarDay(o.ends_on) } : null,
        line: o ? (o.offer_type === 'discount' ? `${rules.inr(pays)} · ${sp.appliedLine(o).replace(' applied', '')}` : `${rules.inr(x.price)} · ${rules.dealLine(o) || o.name}`) : rules.inr(x.price),
      };
    });
  }
  const count = c.kind === 'posts' ? postIds.length : products.length;
  const creator = (await sp.creatorsById([c.influencer_id])).get(c.influencer_id) || null;
  let cover = null;
  if (c.kind === 'products' && products[0]) cover = products[0].image_url;
  const out = {
    id: c.id, name: c.name, kind: c.kind, creator, count, hidden: count === 0, cover,
    line: `${c.name} · ${count} ${c.kind === 'posts' ? `post${count === 1 ? '' : 's'}` : `product${count === 1 ? '' : 's'}`}`,
  };
  if (c.kind === 'posts' && postIds.length) {
    const first = await sp.cards(postIds.slice(0, cardsToo ? postIds.length : 1), who);
    const f0 = first[0];
    if (f0) out.cover = f0.media_kind === 'image' && f0.media[0] ? f0.media[0].url : (f0.products[0] ? f0.products[0].image_url : null);
    if (cardsToo) out.posts = first;
  }
  if (cardsToo && c.kind === 'products') out.products = products;
  return out;
}

async function openCollection(idOrCode, who) {
  const c = await collection(idOrCode, who);
  if (!c) throw notFound();
  return c;
}

/* ───────────────────────────────────────────── F9 · F10 the brand store */

async function brandStore(brandId, who) {
  if (!UUID.test(String(brandId || ''))) throw notFound();
  const brand = (await sp.brandsById([brandId])).get(brandId);
  if (!brand) throw notFound();
  const pool = await sp.livePool({ brandId });
  const creatorIds = [...new Set(pool.map((p) => p.influencer_id))];
  const creators = await sp.creatorsById(creatorIds);
  const offers = await brandOffers(brandId, who, {}, pool);
  return {
    brand,
    line: [brand.city, `${creatorIds.length} creator${creatorIds.length === 1 ? '' : 's'}`, `${pool.length} live post${pool.length === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
    categories: await categoriesOf(pool),
    creators: creatorIds.map((id) => creators.get(id)).filter(Boolean),
    offers_count: offers.offers.length,
  };
}

async function brandPosts(brandId, who, { category = null, creator = null, offer = null, offset = 0 } = {}) {
  if (!UUID.test(String(brandId || ''))) throw notFound();
  let pool = await sp.livePool({ brandId, leafId: UUID.test(String(category || '')) ? category : null, offerId: UUID.test(String(offer || '')) ? offer : null });
  if (UUID.test(String(creator || ''))) pool = pool.filter((p) => p.influencer_id === creator);
  const start = Math.max(0, Number(offset) || 0);
  return { posts: await sp.cards(pool.slice(start, start + PAGE).map((p) => p.id), who), more: pool.length > start + PAGE, next: start + PAGE };
}

/**
 * F10 — the brand's offers that a live post carries, with how many posts and creators. Filters:
 * offer type, price band, category (leaf), theme. An offer with no live post isn't listed.
 */
async function brandOffers(brandId, who, { type = null, band = null, category = null, theme = null } = {}, poolIn = null) {
  if (!UUID.test(String(brandId || ''))) throw notFound();
  let pool = (poolIn || await sp.livePool({ brandId })).filter((p) => p.offer_id);
  if (type && OFFER_TYPES.some((t) => t.key === type)) pool = pool.filter((p) => p.offer_type === type);
  if (UUID.test(String(band || ''))) pool = pool.filter((p) => p.price_band_id === band);
  if (UUID.test(String(category || ''))) pool = pool.filter((p) => (p.category_node_ids || []).includes(category));
  if (UUID.test(String(theme || ''))) pool = pool.filter((p) => (p.theme_tag_ids || []).includes(theme));
  const byOffer = new Map();
  for (const p of pool) {
    const x = byOffer.get(p.offer_id) || { posts: 0, creators: new Set() };
    x.posts += 1; x.creators.add(p.influencer_id);
    byOffer.set(p.offer_id, x);
  }
  if (!byOffer.size) return { types: OFFER_TYPES, offers: [] };
  const { rows } = await db.query(
    `SELECT id, name, offer_type, sub_type, offer_config_json, ends_on FROM brand_offers WHERE id = ANY($1::uuid[]) ORDER BY ends_on, name`, [[...byOffer.keys()]]);
  return {
    types: OFFER_TYPES,
    offers: rows.map((o) => {
      const x = byOffer.get(o.id);
      const ends = rules.dayMonth(calendarDay(o.ends_on));
      return {
        id: o.id, name: o.name, type: o.offer_type, badge: sp.badgeOf(o), deal: rules.dealLine(o) || o.name,
        ends_on: calendarDay(o.ends_on), posts: x.posts, creators: x.creators.size,
        line: `Till ${ends} · in ${x.posts} post${x.posts === 1 ? '' : 's'}${x.creators.size > 1 ? ` by ${x.creators.size} creators` : ''}`,
      };
    }),
  };
}

/** The price bands and theme tags the Offers filters use. */
async function filterWords() {
  const [bands, tags] = await Promise.all([posts.priceBands(), posts.themeTags()]);
  return { price_bands: bands.map((b) => ({ id: b.id, label: b.label })), themes: tags.map((t) => ({ id: t.id, group: t.tag_group, name: t.name })), types: OFFER_TYPES };
}

module.exports = {
  OFFER_TYPES, creatorIdOf, creatorStore, creatorPosts, creatorCollections, openCollection, collection,
  brandStore, brandPosts, brandOffers, filterWords, productOffers, sellable,
};
