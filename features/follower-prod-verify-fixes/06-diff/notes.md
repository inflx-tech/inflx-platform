# 06 — Diff Notes: prod-verify fixes

Four founder-reported bugs from device testing (OTA v118), root-caused in code + fixed.

## Implemented
1. PDP only name+price → new `GET /follower/products/:id` (full row incl. `facets`);
   plain-tap path fetches + merges; new **Product Details** spec block (facets + section
   + returns) + existing description.
2. 3 images not showing → swipeable hero **carousel** from `image_url` +
   `variants_json.cover_images[]` + selected colour `images[]` (deduped) + page dots.
3. Pay-at-Store on fashion PDP → removed: `CATEGORY_CTA_ORDER` fashion/furniture =
   `['online_order']` → single Add-to-Cart CTA (matches locked mockup).
4. "Session expired" on save address → `FollowerLoginScreen` now persists
   `inflx_refresh_token` (both login paths) so the API client refreshes the 15-min
   token silently. Fixes ALL follower writes after 15 min.

## Verification
- backend `node --check` clean (controller + routes).
- `pnpm qa` GREEN gate 0 (mobile inert; backend endpoint additive).
- OTA bundle (metro) compiles. Founder device re-verify before released=true:
  open product (full detail + swipe images + single Add-to-Cart) → cart → checkout →
  add+save address (no session-expired) → place order.

## Note
facets renders defensively (object key→value; arrays joined); products with empty
cover_images fall back to the single image (no empty carousel).
