'use strict';

/**
 * postEligibility.service.js — the live "promise" test (Post/Concept P4).
 * Contract: features/concept-p4-eligibility/ · POST_CONCEPT_MODEL.md §6.
 *
 * eligible(product) = still allocated to this creator (from the post's
 * scoped brands) AND still purchasable (active + pushed, approved brand)
 * AND still satisfies the concept rule. One code path covers price rises,
 * offer expiry, revoked allocation and stock-outs — the founder's collapse
 * of four failure modes into one function.
 *
 * Implementation reuses THE evaluator: the concept's rule_json plus a
 * product_ids pin of the post's attached products, run through
 * library_products with the creator's scoped allocation — whatever comes
 * back is the eligible set. Same truth as shelves, previews and the picker.
 *
 * Collection posts have no rule (family 6): eligibility = attached ∩
 * allocated ∩ purchasable.
 */

const db = require('../config/db');
const concepts = require('./concepts.service');
const sectionLibrary = require('./sectionLibrary.service');
const { runRule } = require('./sectionRules.service');
const notificationService = require('./notification.service');

/** The eligible subset of a post's attached products, computed LIVE.
 * Returns { eligibleIds: Set<uuid>, attachedIds: uuid[] } or null if the
 * post doesn't exist. */
async function eligibleSet(postId) {
  const { rows } = await db.query(
    `SELECT cp.id, cp.influencer_id, cp.scoped_brand_ids, cp.concept_id, cp.collection_id,
            co.template_id, co.category_node_id
       FROM creator_posts cp
       LEFT JOIN concepts co ON co.id = cp.concept_id
      WHERE cp.id = $1`, [postId]);
  const post = rows[0];
  if (!post) return null;

  const { rows: attached } = await db.query(
    `SELECT DISTINCT product_id FROM post_products WHERE post_id = $1`, [postId]);
  const attachedIds = attached.map(r => r.product_id);
  if (!attachedIds.length) return { eligibleIds: new Set(), attachedIds };

  let ruleDef = {};
  if (post.concept_id) {
    const template = await concepts.getTemplate(post.template_id);
    // Hidden/deleted template → concept unreadable; fall back to the
    // collection-style test (allocated + purchasable) rather than darkening
    // every post under an admin vocabulary edit.
    if (template) ruleDef = concepts.ruleJsonFor(template, post.category_node_id || null);
  }
  ruleDef = sectionLibrary.validateRule({ ...ruleDef, product_ids: attachedIds });

  const items = await runRule('library_products', {
    ruleDef,
    influencer: { id: post.influencer_id },
    allocBrandIds: (post.scoped_brand_ids || []).length ? post.scoped_brand_ids : null,
    limit: attachedIds.length,
  });
  return { eligibleIds: new Set(items.map(i => i.id)), attachedIds };
}

/** Recompute one post's cache; fire post.dark on the →0 transition.
 * Returns the new eligible count (or null if post missing). */
async function recomputePost(postId) {
  const result = await eligibleSet(postId);
  if (!result) return null;
  const count = result.eligibleIds.size;

  const { rows } = await db.query(
    `UPDATE creator_posts
        SET eligible_product_count = $2,
            eligibility_checked_at = now(),
            went_dark_at = CASE
              WHEN $2 = 0 AND (eligible_product_count IS NULL OR eligible_product_count > 0)
                THEN now()
              WHEN $2 > 0 THEN NULL
              ELSE went_dark_at END
      WHERE id = $1
      RETURNING influencer_id, status,
        (went_dark_at IS NOT NULL
         AND eligibility_checked_at IS NOT NULL
         AND went_dark_at >= now() - interval '5 seconds') AS just_went_dark`,
    [postId, count]);
  const row = rows[0];

  if (row && row.just_went_dark && row.status === 'approved') {
    try {
      const { rows: u } = await db.query(
        `SELECT u.id FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
        [row.influencer_id]);
      if (u[0]) {
        await notificationService.send({
          userId: u[0].id,
          type: 'post.dark',
          title: 'A post stopped matching its concept',
          body: 'None of its products still satisfy the concept (price/offer/stock changed). It is hidden from followers — your other posts are unaffected.',
          data: { post_id: postId },
        });
      }
    } catch (e) { console.warn('[eligibility] notify (non-fatal):', e.message); }
  }
  return count;
}

/** Sweep every approved post (the cron body). Batched, defensive — one bad
 * post never stops the sweep. */
async function sweep() {
  const { rows } = await db.query(
    `SELECT id FROM creator_posts WHERE status = 'approved' ORDER BY eligibility_checked_at ASC NULLS FIRST`);
  let dark = 0, ok = 0, failed = 0;
  for (const r of rows) {
    try {
      const n = await recomputePost(r.id);
      if (n === 0) dark += 1; else ok += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[eligibility] post ${r.id} failed:`, e.message);
    }
  }
  console.log(`[eligibility] sweep: ${rows.length} approved posts → ${ok} visible, ${dark} dark, ${failed} failed`);
  return { total: rows.length, visible: ok, dark, failed };
}

module.exports = { eligibleSet, recomputePost, sweep };
