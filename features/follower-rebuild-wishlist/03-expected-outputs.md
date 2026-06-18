# 03 — Expected outputs

## Visual (vs locked mockup)
- Header: back chevron + "My Wishlist (N)" in ink on cream `#F6F1EA` bg.
- 2-col tile grid: rounded image, white circular heart (terracotta fill) top-right,
  optional terracotta discount badge top-left, brand (muted caps), product name (ink),
  ₹ price (+ struck original when discounted), optional gold "via @handle" line.
- Persistent bottom tab bar (Home/Offers/Reels/Orders/Profile), Profile active in gold.
- Empty state: gold blob + heart, "Nothing saved yet", subtext, gold "Browse offers" CTA.

## Functional (must remain true — no regression)
- `getSavedOffers()` populates the grid; count = items.length.
- Heart tap → `unsaveOffer(offer_id)` removes the tile; no crash on empty.
- Tile tap → correct CTA screen (default ProductDetail) with offer + tracking + influencer.
- Brand row → BrandStore; via-creator → InfluencerStore.
- Pull-to-refresh re-fetches. Back chevron pops to Profile.
- Tiles with no discount hide the badge + struck price; tiles with no influencer hide
  the via-line (no empty/placeholder UI).

## Non-goals / guardrails
- No new API calls, no saved-products feature, no change to OfferCard or other screens.
- Currency strictly ₹ via existing money formatter.
