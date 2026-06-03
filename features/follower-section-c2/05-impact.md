# Impact — Phase C2 (discovery screens on the engine)

## One-line verdict
**Zero functional disturbance** — a default-OFF flag + additive API methods + a
guarded body swap on the Creator Store. With the flag off the screen behaves
exactly as today; mobile reaches devices only via OTA, not performed here.

## Release classification
- Contract docs/mockups: **deploy-inert**.
- `Packages/Mobile/src` (this commit): **inert** — default-off flag, additive api
  methods, guarded swap; no OTA → no device change. `released=false`.
- Per-screen cutover (later): flag-on + OTA = production-impacting → explicit go.

## What changes (this increment)
- `featureFlags.js` +`SECTION_ENGINE_CREATOR:false`.
- `api.js` +`getCreatorSections` / +`getCreatorCategorySections` (additive).
- `InfluencerStoreScreen.js`: body swapped behind the flag; hero header + search
  unchanged; existing category-grid + hot-picks body preserved as the off/fallback
  path.

## What is NOT disturbed
- Creator Store with the flag off (exact current behavior), all other screens,
  backend, web, brand/influencer apps. Phase A/B/C work — independent.

## Risks + mitigations
- **Renderer fidelity** → `<SectionRenderer>` is the same component verified
  on-device for Home; Creator Store reuses it. Fallback to the existing body on
  error/empty means no regression even if the engine path misbehaves.
- **Offer Engine (brand_offers) coordination** → the engine reads campaign_offers
  today; if the new Offer Engine changes the offer source, the section endpoints
  change server-side — the mobile renderer is data-source-agnostic, so no rework
  here. Flagged for coordination.
- **OTA bundles Window B WIP** → not triggered this commit; flag before any OTA.

## Parallel-window git hygiene
Touches ONLY: `features/follower-section-c2/**`,
`Packages/Mobile/src/config/featureFlags.js`, `Packages/Mobile/src/services/api.js`,
`Packages/Mobile/src/screens/follower/InfluencerStoreScreen.js`. Stage by path;
never `git add -A`; do not branch.
