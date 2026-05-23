'use strict';

/**
 * mealsLearning.service.js — INFLX Meals learning-loop writes (P6).
 *
 * The READ side is already wired (chat() reads meal_customer_preferences
 * and passes memory into prompts; suggestOffersForBrand reads
 * meal_restaurant_learnings). This module supplies the WRITE side so
 * the system gets smarter on every event:
 *
 *   - on every Accept (status → active|accepted) of an offer rule:
 *       discount_appetite + freebie_willingness learnings.
 *   - on every Reject (status → rejected) of an offer rule:
 *       a rejected_reason learning, tagged from the reason text.
 *   - on every paid order:
 *       upsert meal_customer_preferences — favourite_brand_ids union,
 *       rolling budget_per_head, spice_pref / cuisines pulled from
 *       the intent.
 *
 * Owner-confirmed money facts (cost/floor) are recorded via the
 * existing updateOfferRule Modify path when the owner sets a base
 * price — those carry owner_confirmed=true (the founder's locked
 * rule: money facts never AI-guessed).
 */

const PARTY_HEADCOUNT = { single: 1, duo: 2, trio: 3, family: 4, office: 12 };

function headcount(partySize) {
  return PARTY_HEADCOUNT[partySize] || null;
}

/** Tag a free-text rejection reason into a short stable key. */
function rejectedReasonTag(text) {
  if (!text) return 'unspecified';
  const t = String(text).toLowerCase();
  if (/thin|margin|cost|expensive|loss/.test(t)) return 'thin_margin';
  if (/freebie|free/.test(t)) return 'too_many_freebies';
  if (/quantity|qty|amount/.test(t)) return 'wrong_quantities';
  if (/menu|dish|item/.test(t)) return 'wrong_dishes';
  if (/discount|too high|low|low margin/.test(t)) return 'discount_too_high';
  if (/timing|cutoff|slot/.test(t)) return 'wrong_timing';
  return 'other';
}

/**
 * Record a restaurant learning from a status transition on an offer rule.
 * Caller supplies a tx-like { query } so the write composes with the
 * surrounding updateOfferRule transaction.
 */
async function recordRuleStatusChange(tx, brandId, rule, prevStatus) {
  if (!rule || rule.status === prevStatus) return [];
  const written = [];

  // Accept → discount_appetite + (if freebies) freebie_willingness.
  if (rule.status === 'accepted' || rule.status === 'active') {
    if (prevStatus === 'suggested' || rule.discount_value != null) {
      const { rows } = await tx.query(
        `INSERT INTO meal_restaurant_learnings
           (brand_id, learning_type, key, value_json, confidence, owner_confirmed, source)
         VALUES ($1, 'discount_appetite', $2, $3::jsonb, 1.0, true, 'owner')
         RETURNING id`,
        [
          brandId,
          rule.party_size || 'unspecified',
          JSON.stringify({
            base_price: rule.base_price != null ? Number(rule.base_price) : null,
            discount_type: rule.discount_type,
            discount_value: rule.discount_value != null ? Number(rule.discount_value) : null,
            offer_kind: rule.offer_kind,
          }),
        ]
      );
      written.push(rows[0].id);
    }
    const freebies = Array.isArray(rule.freebies_json) ? rule.freebies_json : [];
    if (freebies.length > 0) {
      const { rows } = await tx.query(
        `INSERT INTO meal_restaurant_learnings
           (brand_id, learning_type, key, value_json, confidence, owner_confirmed, source)
         VALUES ($1, 'freebie_willingness', $2, $3::jsonb, 1.0, true, 'owner')
         RETURNING id`,
        [brandId, rule.party_size || 'unspecified', JSON.stringify({ freebies })]
      );
      written.push(rows[0].id);
    }
  }

  // Reject → rejected_reason (the founder's "tell me why" hook).
  if (rule.status === 'rejected') {
    const tag = rejectedReasonTag(rule.rejected_reason);
    const { rows } = await tx.query(
      `INSERT INTO meal_restaurant_learnings
         (brand_id, learning_type, key, value_json, confidence, owner_confirmed, source)
       VALUES ($1, 'rejected_reason', $2, $3::jsonb, 1.0, true, 'owner')
       RETURNING id`,
      [
        brandId,
        tag,
        JSON.stringify({
          full_text: rule.rejected_reason || null,
          party_size: rule.party_size,
          offer_kind: rule.offer_kind,
          had_discount: rule.discount_value != null,
        }),
      ]
    );
    written.push(rows[0].id);
  }

  return written;
}

/**
 * Upsert meal_customer_preferences after a paid order. Favourites are
 * unioned (no dupes); budget rolls toward the new per-head amount;
 * spice/cuisines pulled from the intent when present.
 */
async function upsertCustomerPrefsOnOrder(tx, { followerId, order, intent }) {
  if (!followerId || !order) return null;
  const heads = headcount(order.party_size) || headcount(intent && intent.party_size) || 1;
  const perHead = Number(order.amount || 0) / heads;
  const spice = (intent && intent.spice_level) || null;
  const cuisines = Array.isArray(intent && intent.cuisines) ? intent.cuisines : [];

  const { rows } = await tx.query(
    `INSERT INTO meal_customer_preferences
       (follower_id, spice_pref, budget_per_head, favourite_brand_ids, cuisines)
     VALUES ($1::uuid, $2, $3, ARRAY[$4]::uuid[], $5::text[])
     ON CONFLICT (follower_id) DO UPDATE SET
       spice_pref = COALESCE(EXCLUDED.spice_pref, meal_customer_preferences.spice_pref),
       budget_per_head = CASE
         WHEN EXCLUDED.budget_per_head IS NULL THEN meal_customer_preferences.budget_per_head
         WHEN meal_customer_preferences.budget_per_head IS NULL THEN EXCLUDED.budget_per_head
         ELSE ROUND((meal_customer_preferences.budget_per_head + EXCLUDED.budget_per_head) / 2, 2)
       END,
       favourite_brand_ids = (
         SELECT ARRAY(SELECT DISTINCT b FROM unnest(meal_customer_preferences.favourite_brand_ids || EXCLUDED.favourite_brand_ids) AS b)
       ),
       cuisines = (
         SELECT ARRAY(SELECT DISTINCT c FROM unnest(meal_customer_preferences.cuisines || EXCLUDED.cuisines) AS c)
       ),
       updated_at = now()
     RETURNING *`,
    [followerId, spice, Math.round(perHead * 100) / 100, order.brand_id, cuisines]
  );
  return rows[0];
}

module.exports = {
  PARTY_HEADCOUNT,
  rejectedReasonTag,
  recordRuleStatusChange,
  upsertCustomerPrefsOnOrder,
};
