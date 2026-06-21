# Diff notes — Fixes: redundant address + search ranking

Founder walkthrough fixes; no new mockup (hides a redundant step + improves
ordering on existing screens).

What changed + verified:
- **Address-twice (Issue 1):** `GET /brands/me/listing-config` now returns
  lat/lng/locality/formatted_address; `ListingTemplateLayout` drops the
  "Location" step when the brand already has location (still shown in
  Edit-business-profile mode). So a freshly-registered restaurant no longer
  re-enters its address while listing.
- **Search ranking (Issue 3):** `dishFlywheel.searchMasterDishes` merge now sorts
  exact-name-match first, then similarity, canonical-before-custom, popularity,
  name. Verified: typing "upma" → "Upma" first (food-flywheel-surface 4/4).
- **Dish image upload (Issue 2):** already exists (admin master-dishes page has
  per-dish stock-image upload → default_image_url, inherited onto listed
  products). No change — confirmed only.

brand-web `next build` exit 0. Visual confirmation of the skipped step to be
eyeballed post-deploy with a freshly-registered restaurant.
