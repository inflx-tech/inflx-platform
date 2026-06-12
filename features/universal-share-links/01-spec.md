# Universal Share Links (stores · products · offers)

> Contract slug: `universal-share-links`. Founder ask 2026-06-12: any follower
> can share an **influencer store, a brand store, an individual product, or an
> individual offer** to anyone — "shareable link copy" everywhere.

## Problem (verified via code map)
Only the influencer store had a share scheme (`/s/:handle`), and even its Share
button was a dead placeholder. Brand stores, products, and offers had **no share
URL** at all. There was no copy/share UI on any of the four.

## Scope (v1 — OTA-shippable)
- **Backend** (`tracking.controller` + `app.js`): three new redirect routes
  mirroring `/s/` — `GET /b/:id` (brand store), `/p/:id` (product), `/o/:id`
  (offer). Each logs the click (best-effort into existing `link_clicks`
  columns) and 302-redirects to the follower-app deep path
  (`/business|/product|/offer/:id`), preserving any `cid/sid/oid/iid`.
- **Mobile** (`utils/shareUrl.js` + 3 screens): one canonical builder
  (`/s|/b|/p|/o`) + `shareTarget` (native share sheet) / `copyShareLink`
  (clipboard). Wired in:
  - InfluencerStoreScreen — the dead Share button now shares `/s/:handle`.
  - BrandStoreScreen — a "↗ Share store" chip → `/b/:brand_id`.
  - ProductDetailScreen — the hero ↗ icon now shares `/p/:product_id`, or
    `/o/:brand_offer_id` when it's an offer context.

## Deferred (flagged, NOT in v1)
- **Native universal-link opening** — for a tapped `https://inflx.in/...` link
  to OPEN the app on the right screen needs Android intent-filters / iOS
  associated domains (native), which require an **APK rebuild** (rides the
  pending logo/animation native round). Until then a tapped link resolves via
  `FOLLOWER_APP_URL` like `/s/` does today; the **copy/share UX works now** over
  OTA. The in-app `linking` route map + reading the stored OneSignal pending
  deep-link land with that native round.
- **Public web fallback pages** (browser view without the app) — separate piece.

## Non-goals
- Changing attribution: share links reuse the existing 4-ID scheme + tables.
- New `link_clicks` columns (no migration — best-effort logging only).

## Verification
Backend live smoke: `/b /p /o` → 302 to the right deep path (query preserved);
`/s` unchanged. Mobile: parse-clean; founder device walk (share from each of the
four). `pnpm qa` GREEN (backend regression).
