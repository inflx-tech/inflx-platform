'use strict';

/**
 * collabEarnings.service.js — the two breakdowns a collaboration was missing.
 * Contract: features/collab-phase1-earnings-and-categories  (Phase 1)
 *
 * WHAT ALREADY EXISTED, AND WHY THIS FILE IS SMALL
 * Her earnings split by collaboration was already built and already on screen, and a
 * per-collaboration detail endpoint already listed every individual sale. I planned and
 * briefly built duplicates of both before checking properly; those are gone.
 *
 * Two things were genuinely missing, and only these two live here:
 *
 *   1. WHICH PRODUCTS SOLD — including the ones that sold nothing. Nothing anywhere
 *      grouped a collaboration's sales by product, and nothing listed a product she is
 *      allowed to sell but has not sold. That second half is the point: "Banarasi Gold —
 *      0 sold" is what tells her which one is not working. A list built from sales alone
 *      can never show it.
 *
 *   2. WHICH POST SOLD THEM — every sale already records the post the shopper came
 *      through, and nothing ever read it back.
 *
 * Both attach to the existing detail endpoint rather than standing beside it, so there is
 * one place a collaboration's money is described, not two that can disagree.
 */

const db = require('../config/db');

/**
 * Which of the brand's products sold in this collaboration — and which did not.
 *
 * The list starts from what she is ALLOWED to sell and joins sales onto it, never the
 * reverse. Her allocation is one of three shapes, exactly as the campaign stored it:
 *   store    — everything the brand lists, now and in future
 *   category — one branch of the catalogue, by node or by label
 *   products — a hand-picked list
 */
async function productsFor(campaignInfluencerId) {
  const { rows } = await db.query(
    `WITH me AS (
        SELECT ci.id, ci.alloc_scope, ci.alloc_category_node_id, ci.alloc_category,
               ci.alloc_product_ids, c.brand_id
          FROM campaign_influencers ci
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns     c  ON c.id  = cs.campaign_id
         WHERE ci.id = $1
     ),
     allowed AS (
        SELECT p.* FROM brand_products p, me
         WHERE p.brand_id = me.brand_id
           AND (
             me.alloc_scope = 'store'
             OR (me.alloc_scope = 'category' AND (
                   (me.alloc_category_node_id IS NOT NULL AND p.category_node_id = me.alloc_category_node_id)
                OR (me.alloc_category IS NOT NULL AND p.category_key = me.alloc_category)))
             OR (me.alloc_scope = 'products'
                 AND me.alloc_product_ids IS NOT NULL
                 AND p.id::text = ANY (SELECT jsonb_array_elements_text(me.alloc_product_ids)))
           )
     )
     SELECT a.id AS product_id, a.name AS product_name, a.image_url, a.price,
            a.category_key, a.super_category,
            COALESCE(SUM(ft.net_amount), 0)            AS sales,
            COALESCE(SUM(ft.influencer_commission), 0) AS commission,
            COUNT(ft.id)::int                          AS units
       FROM allowed a
       LEFT JOIN follower_transactions ft
              ON ft.product_id = a.id
             AND ft.campaign_influencer_id = $1
             AND ft.status = 'completed'
      GROUP BY a.id, a.name, a.image_url, a.price, a.category_key, a.super_category
      ORDER BY sales DESC, a.name ASC`,
    [campaignInfluencerId]
  );
  return rows.map(numbers);
}

/**
 * Which of her posts the shopper came through.
 *
 * A sale counts for exactly one post, never split between two — so these add back to the
 * collaboration total, minus anything that arrived without a post (someone who went
 * straight to her shop).
 */
async function postsFor(campaignInfluencerId) {
  const { rows } = await db.query(
    `SELECT cp.id AS post_id, cp.caption, cp.media_kind, cp.post_type,
            COALESCE(SUM(ft.net_amount), 0)            AS sales,
            COALESCE(SUM(ft.influencer_commission), 0) AS commission,
            COUNT(ft.id)::int                          AS orders
       FROM follower_transactions ft
       JOIN creator_posts cp ON cp.id = ft.via_post_id
      WHERE ft.campaign_influencer_id = $1 AND ft.status = 'completed'
      GROUP BY cp.id, cp.caption, cp.media_kind, cp.post_type
      ORDER BY sales DESC`,
    [campaignInfluencerId]
  );
  return rows.map(numbers);
}

/** Amounts arrive from the database as strings. Send numbers. */
function numbers(r) {
  const out = { ...r };
  for (const k of ['sales', 'commission', 'price']) {
    if (out[k] !== undefined) out[k] = Number(out[k] || 0);
  }
  return out;
}

module.exports = { productsFor, postsFor };
