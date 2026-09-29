'use strict';

/**
 * shopperEngagement.service.js — what a shopper keeps and says (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F1, F3, F6, F11, F13 · rules v1.7 §4.15, §5.2–5.4, §5.8
 *
 *   likes and comments   need sign-in (they're public)
 *   saves and follows    work for guests: kept on the phone and moved here at sign-in (merge)
 *   a saved product      remembers the post (or collection item) it came from, so buying it later
 *                        credits that creator and applies that post's offer (M1, M5, M6); if the post
 *                        has left the shop it points to other live posts with the same product (P1)
 *   comments             text only, up to 300 characters, newest first; anyone can report one and
 *                        INFLX admin decides. The creator's reply and hide come with Level 5.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay } = require('../utils/indiaDay');
const rules = require('./offerRules');
const posts = require('./shoppablePosts.service');
const sp = require('./shopperPosts.service');
const stores = require('./shopperStores.service');
const { SHOP_FOR, WELCOME_STYLES, MSG } = require('./shopperCopy');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (m, field = null) => new AppError('VALIDATION_ERROR', m, 422, field);
const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m, 404);
const needFollower = (who) => { if (!who.followerId) throw new AppError('SIGN_IN_REQUIRED', MSG.NO_FOLLOWER, 401); return who.followerId; };

async function postExists(postId) {
  if (!UUID.test(String(postId || ''))) return false;
  const { rows } = await db.query(`SELECT 1 FROM creator_posts WHERE id = $1 AND v2 AND post_code IS NOT NULL`, [postId]);
  return !!rows[0];
}

/* ───────────────────────────────────────────── like · save a post */

async function setLike(who, postId, on) {
  const fid = needFollower(who);
  if (!(await postExists(postId))) throw notFound(MSG.GONE);
  if (on) await db.query(`INSERT INTO post_likes (post_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, fid]);
  else await db.query(`DELETE FROM post_likes WHERE post_id = $1 AND follower_id = $2`, [postId, fid]);
  const { rows: [r] } = await db.query(`SELECT count(*)::int AS n FROM post_likes WHERE post_id = $1`, [postId]);
  return { liked: on, likes: r.n };
}

async function setSave(who, postId, on) {
  const fid = needFollower(who);
  if (!(await postExists(postId))) throw notFound(MSG.GONE);
  if (on) await db.query(`INSERT INTO post_saves (post_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, fid]);
  else await db.query(`DELETE FROM post_saves WHERE post_id = $1 AND follower_id = $2`, [postId, fid]);
  return { saved: on };
}

/* ───────────────────────────────────────────── saved products (F3 heart, F11) */

/** Heart a product in a post (or a collection item): it keeps that post's offer. */
async function saveProduct(who, { product_id: productId, post_id: postId = null, collection_item_id: itemId = null } = {}) {
  const fid = needFollower(who);
  await checkProductSource(productId, postId, itemId);
  await db.query(
    `INSERT INTO follower_wishlist_items (follower_id, product_id, post_id, collection_item_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (follower_id, product_id) DO UPDATE SET post_id = EXCLUDED.post_id, collection_item_id = EXCLUDED.collection_item_id, created_at = now()`,
    [fid, productId, postId || null, itemId || null]);
  return { saved: true };
}

async function checkProductSource(productId, postId, itemId) {
  if (!UUID.test(String(productId || ''))) throw bad('Choose a product.', 'product_id');
  if (postId) {
    const { rows } = await db.query(`SELECT 1 FROM post_products WHERE post_id = $1 AND product_id = $2`, [postId, productId]);
    if (!rows[0]) throw bad("That product isn't in this post.", 'post_id');
    return;
  }
  if (itemId) {
    const { rows } = await db.query(`SELECT 1 FROM creator_collection_items WHERE id = $1 AND product_id = $2`, [itemId, productId]);
    if (!rows[0]) throw bad("That product isn't in this collection.", 'collection_item_id');
    return;
  }
  // P1: a product is always saved from somewhere it can be bought.
  throw bad('Save a product from a post or a collection.', 'post_id');
}

async function unsaveProduct(who, productId) {
  const fid = needFollower(who);
  await db.query(`DELETE FROM follower_wishlist_items WHERE follower_id = $1 AND product_id = $2`, [fid, productId]);
  return { saved: false };
}

/**
 * F11 — each saved product with the post it came from and that post's offer. When the post has
 * left the shop: "No longer available with this offer", and the other live posts carrying it.
 */
async function shapeSavedProducts(list, who) {
  const out = [];
  const postIds = [...new Set(list.map((x) => x.post_id).filter(Boolean))];
  const live = await sp.livePool({ ids: postIds });
  const liveIds = new Set(live.map((p) => p.id));
  const liveCards = new Map((await sp.cards([...liveIds], who)).map((c) => [c.id, c]));
  const itemIds = list.map((x) => x.collection_item_id).filter(Boolean);
  const { rows: items } = itemIds.length ? await db.query(
    `SELECT cci.id, cci.collection_id, cci.campaign_influencer_id, cc.influencer_id FROM creator_collection_items cci
       JOIN creator_collections cc ON cc.id = cci.collection_id WHERE cci.id = ANY($1::uuid[])`, [itemIds]) : { rows: [] };
  const itemById = new Map(items.map((r) => [r.id, r]));
  const creators = await sp.creatorsById(items.map((r) => r.influencer_id));
  const productIds = [...new Set(list.map((x) => x.product_id))];
  const { rows: prods } = productIds.length ? await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.stock, bp.is_active, bp.pushed_to_store, b.business_name AS brand_name
       FROM brand_products bp JOIN brands b ON b.id = bp.brand_id WHERE bp.id = ANY($1::uuid[])`, [productIds]) : { rows: [] };
  const prodById = new Map(prods.map((r) => [r.id, r]));
  const elsewhere = await otherLivePosts(productIds);
  for (const x of list) {
    const pr = prodById.get(x.product_id);
    if (!pr) continue;
    const base = { product_id: x.product_id, post_id: x.post_id || null, collection_item_id: x.collection_item_id || null,
      name: pr.name, image_url: pr.image_url, brand_name: pr.brand_name, price: Number(pr.price) };
    if (x.post_id && liveCards.has(x.post_id)) {
      const c = liveCards.get(x.post_id);
      const inPost = c.products.find((p) => p.id === x.product_id);
      if (inPost && inPost.in_stock) {
        const offer = c.offer ? `${c.offer.badge ? c.offer.badge.charAt(0) + c.offer.badge.slice(1).toLowerCase() : c.offer.line}${c.offer.ends_on ? ` till ${rules.dayMonth(c.offer.ends_on)}` : ''}` : 'normal price';
        out.push({ ...base, available: true, shopper_price: inPost.shopper_price, struck: inPost.struck,
          from: `From ${c.creator.name}'s post · ${offer}`, creator: c.creator });
        continue;
      }
    }
    if (x.collection_item_id && itemById.has(x.collection_item_id)) {
      const it = itemById.get(x.collection_item_id);
      const ok = await stores.sellable([{ ci: it.campaign_influencer_id, product: x.product_id }]);
      const onSale = pr.is_active && pr.pushed_to_store && (pr.stock == null || Number(pr.stock) > 0);
      if (ok.has(`${it.campaign_influencer_id}:${x.product_id}`) && onSale) {
        const offers = await stores.productOffers([{ ci: it.campaign_influencer_id, product: x.product_id }]);
        const o = offers.get(`${it.campaign_influencer_id}:${x.product_id}`) || null;
        const pays = posts.shopperPrice(o, pr.price);
        const creator = creators.get(it.influencer_id);
        out.push({ ...base, available: true, shopper_price: pays, struck: pays < Number(pr.price),
          from: `From ${creator ? creator.name : 'a creator'}'s collection${o ? ` · ${rules.dealLine(o) || o.name}` : ''}`, creator });
        continue;
      }
    }
    // Gone: it can't be bought outside a post (P1) — point to the posts still carrying it.
    const others = (elsewhere.get(x.product_id) || []).filter((id) => id !== x.post_id);
    let gone = MSG.SAVED_GONE_COLLECTION;
    if (x.post_id) {
      const p = await posts.getAny(x.post_id);
      const who2 = p ? (await sp.creatorsById([p.influencer_id])).get(p.influencer_id) : null;
      const day = p && p.removed ? (p.removed.offer_ended_on || (p.removed.at ? calendarDay(p.removed.at) : null)) : null;
      gone = MSG.SAVED_GONE(who2 ? who2.name : 'The creator', day ? rules.dayMonth(day) : null);
    }
    out.push({ ...base, available: false, gone_line: gone, other_posts: others,
      other_line: others.length ? `Live in ${others.length} other post${others.length === 1 ? '' : 's'}` : null });
  }
  return out;
}

async function otherLivePosts(productIds) {
  const out = new Map();
  if (!productIds.length) return out;
  const pool = await sp.livePool({ limit: 3000 });
  if (!pool.length) return out;
  const { rows } = await db.query(
    `SELECT product_id, post_id FROM post_products WHERE product_id = ANY($1::uuid[]) AND post_id = ANY($2::uuid[])`,
    [productIds, pool.map((p) => p.id)]);
  for (const r of rows) out.set(r.product_id, [...(out.get(r.product_id) || []), r.post_id]);
  return out;
}

/** F11 for a signed-in shopper. */
async function saved(who) {
  const fid = needFollower(who);
  const { rows: sp1 } = await db.query(`SELECT post_id FROM post_saves WHERE follower_id = $1 ORDER BY created_at DESC`, [fid]);
  const { rows: pr } = await db.query(
    `SELECT product_id, post_id, collection_item_id FROM follower_wishlist_items WHERE follower_id = $1 ORDER BY created_at DESC`, [fid]);
  return { posts: await sp.cards(sp1.map((r) => r.post_id), who), products: await shapeSavedProducts(pr, who) };
}

/** F11 for a guest: the phone sends what it keeps and gets the same shapes back. */
async function resolveSaved(who, { posts: postIds = [], products = [] } = {}) {
  const list = (Array.isArray(products) ? products : []).filter((x) => x && UUID.test(String(x.product_id || '')))
    .map((x) => ({ product_id: x.product_id, post_id: UUID.test(String(x.post_id || '')) ? x.post_id : null,
      collection_item_id: UUID.test(String(x.collection_item_id || '')) ? x.collection_item_id : null }));
  return { posts: await sp.cards(sp.cleanIds(postIds), who), products: await shapeSavedProducts(list.slice(0, 200), who) };
}

/* ───────────────────────────────────────────── comments (F6) */

const ago = (at) => {
  const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return rules.dayMonth(new Date(at).toISOString().slice(0, 10));
};
const initials = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·';

async function comments(postId, who, { before = null, limit = 30 } = {}) {
  if (!(await postExists(postId))) throw notFound(MSG.GONE);
  const params = [postId, Math.min(100, Math.max(1, Number(limit) || 30))];
  let extra = '';
  if (before && !Number.isNaN(new Date(before).getTime())) { params.push(new Date(before)); extra = ` AND c.created_at < $3`; }
  const { rows } = await db.query(
    `SELECT c.id, c.body, c.created_at, c.author_kind, c.follower_id, c.reply_to,
            COALESCE(u.name, COALESCE(i.full_name, iu.name)) AS name
       FROM post_comments c
       LEFT JOIN followers f ON f.id = c.follower_id LEFT JOIN users u ON u.id = f.user_id
       LEFT JOIN influencers i ON i.id = c.influencer_id LEFT JOIN users iu ON iu.id = i.user_id
      WHERE c.post_id = $1 AND c.status = 'visible'${extra}
      ORDER BY c.created_at DESC LIMIT $2`, params);
  const { rows: [t] } = await db.query(`SELECT count(*)::int AS n FROM post_comments WHERE post_id = $1 AND status = 'visible'`, [postId]);
  return {
    total: t.n,
    signed_in: !!who.followerId,
    sign_in: who.followerId ? null : { title: MSG.SIGN_IN, body: MSG.SIGN_IN_WHY },
    comments: rows.map((r) => ({
      id: r.id, body: r.body, at: r.created_at, ago: ago(r.created_at), reply_to: r.reply_to,
      author: { name: r.name || 'Shopper', initials: initials(r.name), creator: r.author_kind === 'creator' },
      mine: !!(who.followerId && r.follower_id === who.followerId),
      can_report: !(who.followerId && r.follower_id === who.followerId),
    })),
  };
}

async function addComment(who, postId, body) {
  const fid = needFollower(who);
  if (!(await postExists(postId))) throw notFound(MSG.GONE);
  const text = String(body || '').trim();
  if (!text) throw bad(MSG.COMMENT_EMPTY, 'body');
  if (text.length > 300) throw bad(MSG.COMMENT_LONG, 'body');
  const { rows } = await db.query(
    `INSERT INTO post_comments (post_id, author_kind, follower_id, body) VALUES ($1, 'follower', $2, $3) RETURNING id`, [postId, fid, text]);
  return (await comments(postId, who, { limit: 1 })).comments.find((c) => c.id === rows[0].id) || { id: rows[0].id, body: text };
}

async function reportComment(who, commentId) {
  const fid = needFollower(who);
  if (!UUID.test(String(commentId || ''))) throw notFound();
  const { rows } = await db.query(`SELECT id, follower_id FROM post_comments WHERE id = $1 AND status = 'visible'`, [commentId]);
  if (!rows[0]) throw notFound();
  if (rows[0].follower_id === fid) throw bad("You can't report your own comment.");
  await db.query(`INSERT INTO post_comment_reports (comment_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [commentId, fid]);
  return { reported: true, message: MSG.REPORTED };
}

/* ───────────────────────────────────────────── admin: the reports queue */

async function reportedComments() {
  const { rows } = await db.query(
    `SELECT c.id, c.body, c.created_at, c.post_id, cp.post_code, COALESCE(u.name, 'Shopper') AS author,
            COALESCE(i.full_name, iu.name) AS creator, b.business_name AS brand,
            count(r.*)::int AS reports, min(r.created_at) AS first_report
       FROM post_comment_reports r JOIN post_comments c ON c.id = r.comment_id
       JOIN creator_posts cp ON cp.id = c.post_id JOIN brands b ON b.id = cp.brand_id
       JOIN influencers i ON i.id = cp.influencer_id JOIN users iu ON iu.id = i.user_id
       LEFT JOIN followers f ON f.id = c.follower_id LEFT JOIN users u ON u.id = f.user_id
      WHERE r.decided_at IS NULL AND c.status = 'visible'
      GROUP BY c.id, cp.post_code, u.name, i.full_name, iu.name, b.business_name
      ORDER BY min(r.created_at)`);
  return { comments: rows.map((r) => ({ ...r, ago: ago(r.first_report) })) };
}

async function decideComment(adminUserId, commentId, decision) {
  if (!['removed', 'kept'].includes(decision)) throw bad('Choose Remove or Keep.', 'decision');
  if (!UUID.test(String(commentId || ''))) throw notFound();
  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(`SELECT id FROM post_comments WHERE id = $1`, [commentId]);
    if (!rows[0]) throw notFound();
    if (decision === 'removed') {
      await tx.query(`UPDATE post_comments SET status = 'removed', removed_at = now(), removed_by = $2 WHERE id = $1`, [commentId, adminUserId || null]);
    }
    await tx.query(`UPDATE post_comment_reports SET decided_at = now(), decision = $2, decided_by = $3 WHERE comment_id = $1 AND decided_at IS NULL`,
      [commentId, decision, adminUserId || null]);
    return { id: commentId, decision };
  });
}

/* ───────────────────────────────────────────── follows (5.2) */

async function setFollow(who, influencerId, on) {
  const fid = needFollower(who);
  if (!UUID.test(String(influencerId || ''))) throw notFound();
  const { rows } = await db.query(`SELECT 1 FROM influencers WHERE id = $1`, [influencerId]);
  if (!rows[0]) throw notFound();
  if (on) await db.query(`INSERT INTO follower_follows (follower_id, influencer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [fid, influencerId]);
  else await db.query(`DELETE FROM follower_follows WHERE follower_id = $1 AND influencer_id = $2`, [fid, influencerId]);
  const { rows: [n] } = await db.query(`SELECT count(*)::int AS n FROM follower_follows WHERE influencer_id = $1`, [influencerId]);
  return { following: on, followers: n.n };
}

async function following(who) {
  const ids = new Set(who.follows || []);
  if (who.followerId) {
    const { rows } = await db.query(`SELECT influencer_id FROM follower_follows WHERE follower_id = $1 ORDER BY followed_at DESC`, [who.followerId]);
    for (const r of rows) ids.add(r.influencer_id);
  }
  const m = await sp.creatorsById([...ids]);
  return { creators: [...ids].map((id) => m.get(id)).filter(Boolean) };
}

/**
 * Sign-in: what the guest kept on the phone moves to her account, and what she did as a guest
 * joins her account's record (5.2, 5.14). Safe to call twice.
 */
async function merge(who, { follows = [], saved_posts: savedPosts = [], saved_products: savedProducts = [] } = {}) {
  const fid = needFollower(who);
  const f = sp.cleanIds(follows);
  const s = sp.cleanIds(savedPosts);
  let moved = { follows: 0, saved_posts: 0, saved_products: 0, events: 0 };
  if (f.length) {
    const r = await db.query(`INSERT INTO follower_follows (follower_id, influencer_id)
      SELECT $1, i.id FROM influencers i WHERE i.id = ANY($2::uuid[]) ON CONFLICT DO NOTHING`, [fid, f]);
    moved.follows = r.rowCount;
  }
  if (s.length) {
    const r = await db.query(`INSERT INTO post_saves (post_id, follower_id)
      SELECT cp.id, $1 FROM creator_posts cp WHERE cp.id = ANY($2::uuid[]) AND cp.v2 ON CONFLICT DO NOTHING`, [fid, s]);
    moved.saved_posts = r.rowCount;
  }
  for (const x of (Array.isArray(savedProducts) ? savedProducts : []).slice(0, 200)) {
    try { await saveProduct(who, x); moved.saved_products += 1; } catch (e) { /* a product that can no longer be saved is skipped */ }
  }
  if (who.deviceId) {
    const r = await db.query(`UPDATE post_events SET follower_id = $1 WHERE device_id = $2 AND follower_id IS NULL`, [fid, who.deviceId]);
    moved.events = r.rowCount;
  }
  return { moved };
}

/* ───────────────────────────────────────────── Welcome and Profile (F1, F13) */

async function cities() {
  const { rows } = await db.query(
    `SELECT c.id, c.name, s.name AS state FROM ref_cities c LEFT JOIN ref_states s ON s.id = c.state_id
      WHERE c.is_offered AND c.lat IS NOT NULL ORDER BY c.name`);
  return rows;
}

async function welcome() {
  const { rows } = await db.query(`SELECT id, name, tag_group FROM theme_tags WHERE status = 'active' AND name = ANY($1::text[])`, [WELCOME_STYLES]);
  const byName = new Map(rows.map((r) => [r.name, r]));
  return {
    shop_for: SHOP_FOR,
    styles: WELCOME_STYLES.map((n) => byName.get(n)).filter(Boolean).map((r) => ({ id: r.id, name: r.name })),
    cities: await cities(),
    location_line: "We use your phone's location to show creators and stores near you. We never store it.",
  };
}

async function setPreferences(who, { city_id: cityId, shop_for: shopFor, style_tag_ids: styles, welcomed } = {}) {
  const fid = needFollower(who);
  const sets = [];
  const params = [fid];
  const add = (sql, v) => { params.push(v); sets.push(`${sql} = $${params.length}`); };
  if (cityId !== undefined) {
    if (cityId === null) add('city_id', null);
    else {
      const { rows } = await db.query(`SELECT id FROM ref_cities WHERE id = $1 AND is_offered AND lat IS NOT NULL`, [Number(cityId) || 0]);
      if (!rows[0]) throw bad(MSG.CITY_UNKNOWN, 'city_id');
      add('city_id', rows[0].id);
    }
  }
  if (shopFor !== undefined) {
    const list = [...new Set((Array.isArray(shopFor) ? shopFor : []).map((s) => String(s).toLowerCase()))];
    if (list.some((s) => !SHOP_FOR.some((x) => x.key === s))) throw bad(MSG.SHOP_FOR_UNKNOWN, 'shop_for');
    add('shop_for', list);
  }
  if (styles !== undefined) {
    const ids = sp.cleanIds(styles);
    if (ids.length) {
      const { rows } = await db.query(`SELECT id FROM theme_tags WHERE id = ANY($1::uuid[]) AND status = 'active'`, [ids]);
      if (rows.length !== ids.length) throw bad(MSG.STYLE_UNKNOWN, 'style_tag_ids');
    }
    add('style_tag_ids', ids);
  }
  if (welcomed) sets.push('welcomed_at = COALESCE(welcomed_at, now())');
  if (sets.length) await db.query(`UPDATE followers SET ${sets.join(', ')} WHERE id = $1`, params);
  return profile(who);
}

async function profile(who) {
  const fid = needFollower(who);
  const { rows: [f] } = await db.query(
    `SELECT f.id, f.city_id, f.shop_for, f.style_tag_ids, f.welcomed_at, u.name, u.phone, c.name AS city
       FROM followers f JOIN users u ON u.id = f.user_id LEFT JOIN ref_cities c ON c.id = f.city_id WHERE f.id = $1`, [fid]);
  const { rows: [n] } = await db.query(`SELECT count(*)::int AS n FROM follower_follows WHERE follower_id = $1`, [fid]);
  const { rows: [o] } = await db.query(
    `SELECT count(*)::int AS n FROM follower_orders fo JOIN follower_transactions ft ON ft.id = fo.transaction_id
      WHERE ft.follower_id = $1 AND fo.order_status IN ('confirmed', 'dispatched')`, [fid]);
  const { rows: tags } = (f.style_tag_ids || []).length
    ? await db.query(`SELECT id, name FROM theme_tags WHERE id = ANY($1::uuid[])`, [f.style_tag_ids]) : { rows: [] };
  const phone = String(f.phone || '').replace(/\D/g, '');
  const masked = phone.length >= 10 ? `+91 ${phone.slice(-10, -8)}${phone.slice(-8, -7)}••• ••${phone.slice(-3)}` : null;
  const shopFor = (f.shop_for || []).map((k) => (SHOP_FOR.find((x) => x.key === k) || {}).label).filter(Boolean);
  return {
    name: f.name, phone: masked, city: f.city_id ? { id: f.city_id, name: f.city } : null,
    shop_for: f.shop_for || [], styles: tags.map((t) => ({ id: t.id, name: t.name })), welcomed: !!f.welcomed_at,
    following: n.n, orders_on_the_way: o.n,
    rows: {
      orders: o.n ? `${o.n} on the way` : 'No orders yet',
      following: `${n.n} creator${n.n === 1 ? '' : 's'}`,
      city: f.city || 'Not set',
      shop_for: [shopFor.join(' · '), tags.map((t) => t.name).join(', ')].filter(Boolean).join(' · ') || 'Not set',
    },
  };
}

module.exports = {
  setLike, setSave, saveProduct, unsaveProduct, saved, resolveSaved,
  comments, addComment, reportComment, reportedComments, decideComment,
  setFollow, following, merge, cities, welcome, setPreferences, profile,
};
