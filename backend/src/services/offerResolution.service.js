'use strict';

/**
 * offerResolution.service.js — WHICH offer applies, for a given creator's cart.
 * Contract: features/collab-part4-offers-allocation (§4.3)
 *
 * THE MODEL (founder, 2026-08-11)
 * Offers are created at two levels and reach a creator differently:
 *
 *   · OFFER ENGINE (global) — published offers apply to ANY creator who has those
 *     products allocated. The brand does not assign them per creator. Before this
 *     module, global offers reached the brand's own store and the discovery surface
 *     but NEVER a creator: the creator path consulted only the per-creator
 *     assignment, so a brand had to attach an offer to every creator one at a time.
 *
 *   · CAMPAIGN LEVEL (creator-specific) — a special offer for one creator, either
 *     built inline or attached from the library (already snapshotted onto the
 *     campaign_influencers row by resolveOfferAttachment).
 *
 * RESOLUTION — best single offer per checkout. Never combined, never stacked.
 *
 * The first design resolved per PRODUCT, splitting one cart into groups each
 * governed by a different offer. That is fine for flat and percentage discounts,
 * which are per-product, and it breaks volume, bundle and BOGO, which are
 * cart-shaped: they need a threshold to measure or several specific products
 * present, and splitting the cart destroys exactly that. It also produced a perverse
 * outcome — a creator-specific "25% off kurtas" would break a global 3-item bundle
 * and leave the customer WORSE OFF because the creator had a special offer.
 *
 * So: score every candidate against the WHOLE cart and apply the best. The founder's
 * override rule survives as a consequence — the brand makes a creator's offer better,
 * so it wins — and it can no longer backfire.
 *
 * This module holds NO discount maths. offer.service.resolveOfferDiscount is a pure
 * "score one offer against one cart" function that already handles all five offer
 * types with their own scope filtering and returns zero-with-a-reason rather than
 * throwing. That is exactly the contract a candidate loop needs, so the money maths
 * stays untouched and the risk here is confined to WHICH offer is chosen.
 */

// db is required LAZILY (see campaignRollup for the same reason): fetchLiveGlobalOffers
// takes its connection as an argument so the candidate rules can be executed against a
// stubbed catalogue without booting the database config.
const offerService = require('./offer.service');

// A brand with a pathological number of published offers would turn checkout into a
// scoring loop. Cap it and say so — never degrade silently. Production currently has
// 5 library offers in total, so this is a backstop, not a working limit.
const MAX_GLOBAL_CANDIDATES = 50;

const NO_OFFER = Object.freeze({
  discount_amount: 0,
  applied_to: 'cart_total',
  reason: 'No offer — full price',
  offer_source: null,
  offer_id: null,
});

/**
 * Published, currently-live offers from the brand's engine.
 *
 * §5.1 (founder-answered): only a PUBLISHED offer reaches creators. Unpublished
 * drafts must never leak. This reuses the same live-offer definition the discovery
 * surface uses, so a product's headline discount and a creator's checkout agree on
 * which offers are real.
 */
async function fetchLiveGlobalOffers(brandId, conn = null) {
  if (!brandId) return [];
  // eslint-disable-next-line global-require
  const cx = conn || require('../config/db');
  const { rows } = await cx.query(
    `SELECT id, name, offer_type, offer_config_json
       FROM brand_offers
      WHERE brand_id = $1
        AND status = 'active'
        AND published_to_store = true
        AND (store_starts_at IS NULL OR store_starts_at <= now())
        AND (store_ends_at   IS NULL OR store_ends_at   >= now())
      ORDER BY created_at DESC
      LIMIT $2`,
    [brandId, MAX_GLOBAL_CANDIDATES + 1]
  );
  if (rows.length > MAX_GLOBAL_CANDIDATES) {
    console.warn(
      `[offerResolution] brand ${brandId} has more than ${MAX_GLOBAL_CANDIDATES} live global offers; ` +
      `scoring the ${MAX_GLOBAL_CANDIDATES} most recent. Older offers are NOT being considered.`
    );
    return rows.slice(0, MAX_GLOBAL_CANDIDATES);
  }
  return rows;
}

/**
 * Has this creator's campaign-level offer passed its own deadline?
 *
 * §4.4 — offer_valid_until, NOT offer_expires_at. The latter is the
 * invitation-acceptance clock driven by offer-expiry.job; treating it as a discount
 * deadline would silently expire invitations. Past the deadline the discount stops
 * while the allocation, storefront and commission continue.
 */
function creatorOfferExpired(ci, now = new Date()) {
  return !!ci?.offer_valid_until && new Date(ci.offer_valid_until) < now;
}

/**
 * Build the candidate list. Creator-specific first — it is the tie-break winner.
 */
async function buildCandidates({ ci, brandId, now, conn }) {
  const candidates = [];

  const type = ci?.offer_type ?? ci?.ci_offer_type ?? null;
  if (type && !creatorOfferExpired(ci, now)) {
    candidates.push({
      source: 'creator',
      offer_id: ci.brand_offer_id || null,
      offerType: type,
      offerConfig: ci.offer_config_json || {},
    });
  }

  for (const g of await fetchLiveGlobalOffers(brandId, conn)) {
    candidates.push({
      source: 'global',
      offer_id: g.id,
      offerType: g.offer_type,
      offerConfig: g.offer_config_json || {},
    });
  }

  return candidates;
}

/**
 * Score EVERY candidate against the cart and say which one wins.
 *
 * Ties go to the creator-specific offer: equal money, but it is the one the brand
 * chose for this creator, so it is the honest thing to name on a receipt.
 *
 * Split out of resolveBestOffer for the brand's basket preview
 * (features/stage-2-build-a-campaign-from-the-phone, ledger #96), which has to show the
 * losers too — "Buy 2 get 1 free · not applied · needs 3 items" is the sentence that
 * stops a brand publishing an offer they have not seen resolve.
 *
 * The preview must never carry its own copy of this loop. An offer preview that can
 * disagree with checkout is worse than no preview at all, because the brand then trusts
 * a number that will not happen.
 *
 * @returns { candidates: [{ source, offer_id, offerType, discount_amount, reason,
 *            applied }], best: null | { scored, c, amount } }
 */
async function scoreAllCandidates({
  ci, brandId, items = [], priceMap, variantPriceMap, productMetaMap, billAmount, now, conn,
}) {
  const candidates = await buildCandidates({ ci, brandId, now, conn });
  const scoredAll = [];
  let best = null;

  for (const c of candidates) {
    const scored = offerService.resolveOfferDiscount({
      offerType: c.offerType,
      offerConfig: c.offerConfig,
      items,
      priceMap,
      variantPriceMap,
      productMetaMap,
      billAmount,
    });
    const amount = Number(scored.discount_amount || 0);
    scoredAll.push({
      source: c.source,
      offer_id: c.offer_id,
      offer_type: c.offerType,
      discount_amount: amount,
      reason: scored.reason || null,
      applied: amount > 0,
    });
    if (amount <= 0) continue;                       // did not apply to this cart

    if (!best) { best = { scored, c, amount }; continue; }
    if (amount > best.amount) { best = { scored, c, amount }; continue; }
    // Equal money → prefer the creator-specific one.
    if (amount === best.amount && c.source === 'creator' && best.c.source !== 'creator') {
      best = { scored, c, amount };
    }
  }

  scoredAll.forEach((s) => {
    s.wins = !!best && s.source === best.c.source && s.offer_id === best.c.offer_id && s.applied;
  });

  return { candidates: scoredAll, best, considered: candidates.length };
}

/**
 * The winner alone — what every checkout path calls.
 *
 * @returns the winning resolveOfferDiscount result plus offer_source
 *          ('creator' | 'global' | null) and offer_id.
 */
async function resolveBestOffer(args) {
  const { candidates, best, considered } = await scoreAllCandidates(args);
  if (considered === 0) return { ...NO_OFFER };

  if (!best) {
    // Candidates existed but none applied — keep WHY, it is the difference between
    // "no offer" and "your basket did not qualify".
    const reasons = candidates.length === 1 ? null : `${candidates.length} offers considered, none applied`;
    return { ...NO_OFFER, reason: reasons || NO_OFFER.reason };
  }

  return { ...best.scored, offer_source: best.c.source, offer_id: best.c.offer_id };
}

module.exports = {
  resolveBestOffer,
  scoreAllCandidates,
  fetchLiveGlobalOffers,
  creatorOfferExpired,
  MAX_GLOBAL_CANDIDATES,
};
