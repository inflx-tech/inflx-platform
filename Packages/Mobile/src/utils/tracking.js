/**
 * tracking.js — TrackingContext construction utilities.
 *
 * The platform's commission model (contracts-v1 §5) requires every
 * follower navigation that originates from a creator-attributed surface
 * (feed card, influencer store, saved deal, deal-list card) to thread
 * tracking through to the destination so commission writes survive.
 *
 * Phase Salon-2 audit found ~6 screens that navigate to BrandStore without
 * tracking, silently dropping attribution at the entry point. This helper
 * normalizes tracking construction across those sites:
 *
 *   buildTracking(item)
 *     · Accepts a feed/deal/saved-offer item (item.tracking + item.influencer
 *       conventions vary across surfaces)
 *     · Returns a normalized TrackingContext { campaign_id, set_id, offer_id,
 *       campaign_influencer_id, influencer_id } or null when nothing is
 *       attributable (pure organic browse)
 *
 *   buildTrackingFromOffer(offer, influencer?)
 *     · For surfaces where each store/brand has an embedded offers[] array
 *       (CategoryListScreen). Pulls campaign/set/offer/CI from the offer row
 *       directly; influencer_id is derived from offer.influencer_id if
 *       present, else from an explicit `influencer` arg.
 *
 * Lives in Packages/Mobile/src/utils/ (not Packages/shared/) because Metro
 * has no monorepo workspace config — anything mobile imports must live
 * within Packages/Mobile/. Restore to shared/ when workspace resolution
 * lands.
 */

/**
 * Build a normalized TrackingContext from a feed/deal/saved-offer item.
 * Returns null when nothing attributable is present.
 */
export function buildTracking(item) {
  if (!item) return null;
  const t = item.tracking || {};
  const inf = item.influencer || null;
  const infId = t.influencer_id || inf?.id || null;
  const hasAttribution =
    !!t.campaign_id ||
    !!t.set_id ||
    !!t.offer_id ||
    !!t.campaign_influencer_id ||
    !!infId;
  if (!hasAttribution) return null;
  return {
    campaign_id: t.campaign_id || null,
    set_id: t.set_id || null,
    offer_id: t.offer_id || null,
    campaign_influencer_id: t.campaign_influencer_id || null,
    influencer_id: infId,
  };
}

/**
 * Build a TrackingContext from a single offer row (CategoryListScreen
 * pattern: store.offers[0] is the best offer driving the discount badge).
 * Optional `influencer` arg provides the influencer_id fallback for offer
 * rows that don't carry it directly.
 */
export function buildTrackingFromOffer(offer, influencer = null) {
  if (!offer) return null;
  const infId = offer.influencer_id || influencer?.id || null;
  if (!offer.campaign_id && !offer.offer_id && !infId) return null;
  return {
    campaign_id: offer.campaign_id || null,
    set_id: offer.set_id || null,
    offer_id: offer.offer_id || null,
    campaign_influencer_id: offer.campaign_influencer_id || null,
    influencer_id: infId,
  };
}
