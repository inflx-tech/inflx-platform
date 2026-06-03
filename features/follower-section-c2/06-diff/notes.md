# 06-diff — Phase C2 (discovery screens on the engine)

## C2 COMPLETE — all discovery screens wired (inert), no device change yet
All four remaining discovery screens now branch on a per-screen flag (all default
OFF → byte-identical to today; no OTA performed). Each renders from its live
section endpoint via `<SectionRenderer>` when on, with a fallback to its existing
body on error/empty:

| Screen | File | Flag | Endpoint |
|---|---|---|---|
| Creator Store | InfluencerStoreScreen | SECTION_ENGINE_CREATOR | /section/creator/:handle |
| Creator's Category | CreatorCategoryScreen | SECTION_ENGINE_CREATOR | /section/creator/:handle/category/:cat |
| Category | CategoryListScreen | SECTION_ENGINE_CATEGORY | /section/category/:key |
| Offers | DealsScreen | SECTION_ENGINE_OFFERS | /section/offers |

Home (Phase C) + these four = the full discovery surface, engine-ready and inert.
All babel-verified; each screen keeps its existing chrome (header/search/tabs) and
its existing body as the off/fallback path.

### Verification plan (per founder, deferred to real data)
Wiring is data-independent; visual verification needs real data. After product
listings + real brand campaigns + the Offer Engine land, flip Home + Creator Store
first, verify on-device (Maestro + before/after-diff), and if good proceed to the
rest + D/E/F. `<SectionRenderer>` is already on-device-verified for Home
(`features/follower-section-home/06-diff/after/`).

### Renderer polish still pending (pre-cutover)
Offers/Category use bespoke chrome (hero · sticky chips · 2-col grid) the current
`SectionRenderer` renders as rails only. Extend the renderer for hero/chips/grid
before those two screens' cutover (tracked; not needed while inert).

---
## (history) First increment: Creator Store — no visual change on devices yet
`InfluencerStoreScreen` now branches on `SECTION_ENGINE_CREATOR`:
- flag ON → keep the hero header + search, render the body from `GET /v1/follower/
  section/creator/:handle` via `<SectionRenderer>`, with a fallback to the existing
  category-grid + hot-picks body on error/empty.
- flag OFF (default) → byte-identical to today.

No OTA → devices unaffected. With the flag off there is no before/after delta.

`<SectionRenderer>` was already verified on-device for Home
(`features/follower-section-home/06-diff/after/`); Creator Store reuses the exact
same component, so the visual diff at the Creator-Store cutover is expected to
mirror it. The on-device capture for Creator Store happens at its (gated) cutover,
when the flag is flipped for an internal build and Maestro screenshots a populated
creator.

## Honest notes
- Creator Store keeps its bespoke hero header (avatar/handle/counters/follow/bio)
  as screen chrome; only the shelf body is engine-driven.
- Offers/Category will need `SectionRenderer` extended for hero/chips/grid — a
  later increment.
- The engine reads campaign_offers today; the newly-locked Offer Engine
  (brand_offers) may change the offer source server-side — the renderer is
  data-agnostic, so no mobile rework expected.
