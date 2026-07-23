'use strict';

/**
 * followerPosts.service.js — follower-facing creator posts (Post/Concept P3
 * backend half). Contract: features/concept-p3-follower-backend/.
 *
 * The read side of the new source of truth:
 *   FEED   — approved posts, newest first, followed creators pinned on top.
 *            Optional filters (concept/collection/creator) so P4's banner
 *            feeds and creator stores reuse this exact query.
 *   DETAIL — everything the post viewer renders AT RUNTIME: slides, the
 *            coordinate tags joined to LIVE product data (name/price/best
 *            live discount — a price change shows instantly, no republish),
 *            the Shop-this-post list, and per-product TRACKING (the 4-ID
 *            attribution block from the creator's live campaign for that
 *            brand) so a purchase from a post credits the creator through
 *            the EXISTING commission rails.
 *
 * Visibility = status 'approved'. The live eligibility test ("post goes dark
 * when no attached product still satisfies its concept") is P4 — this module
 * is where it will plug in.
 */

const db = require('../config/db');
const concepts = require('./concepts.service');
const creatorPosts = require('./creatorPosts.service');
const { buildTracking, OFFER_BEST_PCT, offerFieldsFromPct } = require('./sectionRules.service');

// Concept display fields joined flat (batch-safe — no per-row round-trips).
const CONCEPT_JOIN = `
  LEFT JOIN concepts co            ON co.id = cp.concept_id
  LEFT JOIN concept_templates ct   ON ct.id = co.template_id
  LEFT JOIN category_nodes cn      ON cn.id = co.category_node_id
  LEFT JOIN collections col        ON col.id = cp.collection_id`;

function conceptFieldsFromRow(r) {
  if (r.collection_id) {
    return { concept: null, collection: { id: r.collection_id, name: r.collection_name } };
  }
  if (!r.concept_id) return { concept: null, collection: null };
  return {
    concept: {
      id: r.concept_id,
      name: concepts.conceptName(
        { kind: r.t_kind, name_pattern: r.t_pattern }, r.leaf_name),
      family: concepts.familyOf(r.t_kind, !!r.leaf_name),
    },
    collection: null,
  };
}

async function followerIdForUser(userId) {
  if (!userId) return null;
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  return rows[0] ? rows[0].id : null;
}

// ── FEED ─────────────────────────────────────────────────────────────────────

async function listFeed({ userId, conceptId, collectionId, handle, limit = 20, offset = 0 } = {}) {
  const followerId = await followerIdForUser(userId);
  let followedIds = [];
  if (followerId) {
    const { rows } = await db.query(
      `SELECT influencer_id FROM follower_follows WHERE follower_id = $1`, [followerId]);
    followedIds = rows.map(r => r.influencer_id);
  }

  const params = [];
  const where = [`cp.status = 'approved'`];
  if (conceptId) { params.push(conceptId); where.push(`cp.concept_id = $${params.length}`); }
  if (collectionId) { params.push(collectionId); where.push(`cp.collection_id = $${params.length}`); }
  if (handle) { params.push(handle); where.push(`i.instagram_handle = $${params.length}`); }

  params.push(followedIds);
  const followedIdx = params.length;
  params.push(Math.min(Number(limit) || 20, 50));
  params.push(Math.max(Number(offset) || 0, 0));

  const { rows } = await db.query(
    `SELECT cp.id, cp.influencer_id, cp.concept_id, cp.collection_id, cp.caption,
            cp.tag_style, cp.post_type, cp.media_kind, cp.created_at,
            i.instagram_handle AS handle, u.name AS influencer_name,
            i.profile_pic_url AS avatar, u.city AS influencer_city,
            ct.kind AS t_kind, ct.name_pattern AS t_pattern, cn.name AS leaf_name,
            col.name AS collection_name,
            fm.id AS cover_media_id, fm.width AS cover_w, fm.height AS cover_h,
            (SELECT count(*)::int FROM post_media pm WHERE pm.post_id = cp.id) AS slide_count,
            (SELECT count(DISTINCT pp.product_id)::int FROM post_products pp WHERE pp.post_id = cp.id) AS product_count
       FROM creator_posts cp
       JOIN influencers i ON i.id = cp.influencer_id
       JOIN users u ON u.id = i.user_id
       ${CONCEPT_JOIN}
       LEFT JOIN LATERAL (
         SELECT id, width, height FROM post_media pm
          WHERE pm.post_id = cp.id ORDER BY slide_index LIMIT 1
       ) fm ON true
      WHERE ${where.join(' AND ')}
      ORDER BY (cp.influencer_id = ANY($${followedIdx}::uuid[])) DESC, cp.created_at DESC
      LIMIT $${followedIdx + 1} OFFSET $${followedIdx + 2}`,
    params);

  return rows.map(r => ({
    id: r.id,
    creator: {
      id: r.influencer_id, handle: r.handle, name: r.influencer_name,
      avatar: r.avatar, city: r.influencer_city,
      followed: followedIds.includes(r.influencer_id),
    },
    ...conceptFieldsFromRow(r),
    post_type: r.post_type,
    media_kind: r.media_kind,
    tag_style: r.tag_style,
    caption: r.caption,
    cover: r.cover_media_id
      ? { url: creatorPosts.mediaUrl(r.cover_media_id), width: r.cover_w, height: r.cover_h }
      : null,
    slide_count: r.slide_count,
    product_count: r.product_count,
    created_at: r.created_at,
  }));
}

// ── DETAIL ───────────────────────────────────────────────────────────────────

/** Live 4-ID tracking per brand for this creator (newest live assignment wins)
 * — the same attribution block store/section items carry, so the cart claim →
 * commission path needs nothing new. */
async function liveTrackingByBrand(influencerId, brandIds) {
  if (!brandIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (c.brand_id)
            c.brand_id, c.id AS cid, cs.id AS sid, co.id AS oid, ci.id AS iid
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       LEFT JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
      WHERE ci.influencer_id = $1
        AND c.brand_id = ANY($2::uuid[])
        AND ci.status IN ('contracted','active','completed')
        AND c.status  IN ('published','active','live')
        AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      ORDER BY c.brand_id, ci.created_at DESC`,
    [influencerId, brandIds]);
  return new Map(rows.map(r => [r.brand_id, { cid: r.cid, sid: r.sid, oid: r.oid, iid: r.iid }]));
}

async function getPostDetail(postId, { userId } = {}) {
  const { rows } = await db.query(
    `SELECT cp.*, i.instagram_handle AS handle, u.name AS influencer_name,
            i.profile_pic_url AS avatar, u.city AS influencer_city,
            i.followers_count,
            ct.kind AS t_kind, ct.name_pattern AS t_pattern, cn.name AS leaf_name,
            col.name AS collection_name
       FROM creator_posts cp
       JOIN influencers i ON i.id = cp.influencer_id
       JOIN users u ON u.id = i.user_id
       ${CONCEPT_JOIN}
      WHERE cp.id = $1 AND cp.status = 'approved'`,
    [postId]);
  const post = rows[0];
  if (!post) return null;

  const [{ rows: media }, { rows: prods }] = await Promise.all([
    db.query(
      `SELECT id, slide_index, width, height FROM post_media
        WHERE post_id = $1 ORDER BY slide_index`, [postId]),
    db.query(
      `SELECT pp.id, pp.media_id, pp.product_id, pp.x_pct, pp.y_pct,
              bp.name, bp.price, bp.image_url, bp.variants_json,
              bp.is_active, bp.pushed_to_store, bp.stock,
              ${OFFER_BEST_PCT} AS offer_pct,
              b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category
         FROM post_products pp
         JOIN brand_products bp ON bp.id = pp.product_id
         JOIN brands b ON b.id = bp.brand_id
        WHERE pp.post_id = $1`, [postId]),
  ]);

  const brandIds = [...new Set(prods.map(p => p.brand_id))];
  const trackingByBrand = await liveTrackingByBrand(post.influencer_id, brandIds);

  const seen = new Set();
  const shopProducts = [];
  const pins = [];
  for (const t of prods) {
    const price = t.price != null ? Number(t.price) : null;
    const offerFields = offerFieldsFromPct(t.offer_pct, price);
    const purchasable = t.is_active && t.pushed_to_store;
    const tr = trackingByBrand.get(t.brand_id) || null;
    const base = {
      product_id: t.product_id,
      name: t.name,
      price,
      ...offerFields,                        // discount_value + offer_price
      image_url: t.image_url,
      purchasable,
      stock: t.stock,
      brand: { id: t.brand_id, name: t.brand_name, category: t.brand_category },
      tracking: tr ? buildTracking({ handle: post.handle, ...tr }) : null,
      via_creator: tr ? { id: post.influencer_id, handle: post.handle, name: post.influencer_name } : null,
    };
    if (t.x_pct != null && t.y_pct != null) {
      pins.push({ ...base, id: t.id, media_id: t.media_id,
        x_pct: Number(t.x_pct), y_pct: Number(t.y_pct) });
    }
    if (!seen.has(t.product_id)) { seen.add(t.product_id); shopProducts.push(base); }
  }

  return {
    id: post.id,
    creator: {
      id: post.influencer_id, handle: post.handle, name: post.influencer_name,
      avatar: post.avatar, city: post.influencer_city,
      followers_count: post.followers_count,
    },
    ...conceptFieldsFromRow(post),
    post_type: post.post_type,
    media_kind: post.media_kind,
    tag_style: post.tag_style,
    caption: post.caption,
    created_at: post.created_at,
    media: media.map(m => ({
      id: m.id, slide_index: m.slide_index, width: m.width, height: m.height,
      url: creatorPosts.mediaUrl(m.id),
    })),
    pins,                    // floating price tags (runtime-rendered)
    products: shopProducts,  // "Shop this post" — every attached product, deduped
  };
}

module.exports = { listFeed, getPostDetail };
