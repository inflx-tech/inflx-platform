# 06-diff — Phase C2 (discovery screens on the engine)

## This increment: Creator Store — no visual change on devices yet
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
