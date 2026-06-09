# Workflow — Creator's Category rebuild

## Flow
1. In a Creator Store, follower taps a category tab → navigate CreatorCategory
   with { influencer, offers, category, label }.
2. Screen filters the creator's offers to that vertical, flattens offers→products
   (deduped, best discount), derives sub-type chips from product sections + partner brands.
3. Renders: header ({Creator}·{Category} + curated-by) → sub-type chips → Partner brands →
   2-col Picks grid → Top rail → Reels note.
4. Tap a product → ProductDetail (parent offer + 4-ID tracking + via_store_influencer_id).
   Tap a partner brand → BrandStore.

## Expected end state
Matches creator-category-comprehensive.html; shows the creator's PRODUCTS in the vertical.

## Verification
- Babel transform clean (both screens). Founder verifies visuals on device after OTA.
