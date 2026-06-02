# Feature Spec — Follower Home on the Section Engine (Phase C)

> Phase C of the Creator Vibe section-engine program
> (`design/wave4-creator-vibe/IMPLEMENTATION-PLAN.md`). Depends on Phase A
> (`features/follower-section-engine/`, shipped 2026-06-02 — `section_config` +
> `/v1/follower/home` live in prod). Design LOCKED (SECTION-CATALOG.md,
> `home-comprehensive.html`, 2026-06-01).

## Problem / goal
The follower Home (`HomeScreenV2`) renders from a hardcoded feed with hardcoded
slicing ("first 6 = hot, next 6 = trending"). Phase A made Home admin-controlled
on the backend (`GET /v1/follower/home → { sections:[…] }`). Phase C makes the
mobile Home **render from that payload** via a generic `<SectionRenderer>`, so
admins control the shelves with no app update.

## Scope
- **In scope (Phase C):**
  - `config/featureFlags.js` — `SECTION_ENGINE_HOME` flag, **default false**.
  - `followerApi.getHomeSections(loc)` → `GET /v1/follower/home`.
  - `components/SectionRenderer.js` — maps `shelf_type` → existing card
    components (no new card designs): `creators`→InfluencerStoryRow ·
    `nav_tiles`→CategoryGrid · `offers`/`mixed`→NewOfferCard rail ·
    `products`→ProductCard rail · `brands`→brand rail · `controls`→(skipped in
    v1). Every actionable item routes with its 4-ID tracking.
  - Wire `HomeScreenV2`: when `SECTION_ENGINE_HOME` is **on**, fetch `/home` and
    render `<SectionRenderer>`; when **off** (default), the current hardcoded path
    is unchanged. Old↔new behind the flag (safe cutover).
- **Out of scope (later):** Category/Offers/Creator screens (Phase C2) · detail
  templates (D) · Orders/Profile (E) · reels shelves (52.8) · admin Section
  Manager (B) · any new card visual design (reuse current cards).

## Surfaces touched
- `Packages/Mobile/src/` (follower runtime) — UI-governed. No backend change
  (Phase A endpoint already live). No web.
- Roles: follower.

## Data / contracts
- No new tables/endpoints (consumes Phase A's `GET /v1/follower/home`).
- Section payload (Phase A contract): `{ sections:[{ key, shelf_key, title,
  type, item_type, items:[{ entity_type, …, tracking:{cid,sid,oid,iid,url} }] }] }`.
- Tracking: reuse the Mobile `utils/tracking` `buildTracking`; items already carry
  the 4-ID block from the backend.

## Non-functional
- **Cutover safety:** `SECTION_ENGINE_HOME=false` by default → shipping this code
  changes nothing on devices until the flag is flipped (a deliberate, separate
  step with before/after-diff + Maestro + OTA go). Inert on arrival.
- **Failure modes:** `/home` error or empty → fall back to the existing hardcoded
  Home path (never a blank screen); unknown `shelf_type` → skip that section.
- **Gates:** mockup-lock (mockups locked at design), before/after-diff notes,
  `pnpm qa` GREEN, Maestro green at the released=true flip (gov-check Rule 5).
