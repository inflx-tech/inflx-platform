# 01 — Spec: Follower prod-verify fixes (PDP detail/images/CTA + checkout auth)

**Contract:** `follower-prod-verify-fixes` — four founder-reported bugs from real
device testing (OTA v118). Locked references already exist: product-detail.html
(screen 03) + checkout.html. Founder: 'check all these and resolve first' 2026-06-17.

## Bugs + fixes (root-caused in code)
1. **PDP showed only name + price** — a shelf/Results tap passes only the card fields;
   the full listing detail was never fetched. FIX: new `GET /follower/products/:id`
   returns the full product (description, **facets** = schema attributes, variants_json,
   section, tags, return policy); PDP plain-tap path fetches it + renders a
   **Product Details** spec block (facets + section + returns) atop the existing
   description.
2. **3 images didn't show** — only `image_url` was rendered; the extra images live in
   `variants_json.cover_images[]` + per-colour `variants_json.colors[].images[]`. FIX:
   swipeable **hero carousel** built from image_url + cover_images + selected colour's
   images (deduped) + page dots.
3. **Pay-at-Store button shouldn't exist** (locked PDP mockup = Add-to-Cart only). FIX:
   `CATEGORY_CTA_ORDER` fashion/fashion_walkin/fashion_online/furniture → `['online_order']`
   only → the PDP shows a single **Add to Cart** CTA.
4. **Save address → "session expired"** — `FollowerLoginScreen` never stored the refresh
   token, so the API client couldn't refresh the 15-min access token → every follower
   write failed after 15 min. FIX: persist `inflx_refresh_token` on follower login (both
   verify-otp + name-submit paths).

## Scope
Backend: additive read endpoint (no migration). Mobile: PDP fetch+carousel+facets+CTA,
follower login refresh-token, api method. No money/order logic changed.

## Acceptance
- PDP shows full details (facets/description/section) + multi-image carousel + a single
  Add-to-Cart CTA; saving an address after 15 min works (silent token refresh).
- `pnpm qa` GREEN gate 0; backend node --check clean; OTA bundle compiles. released=false
  until founder re-verify on device.
