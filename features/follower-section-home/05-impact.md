# Impact — Follower Home on the Section Engine (Phase C)

## One-line verdict
**Zero functional disturbance on arrival** — the foundation commit adds a
default-OFF flag, an additive API method, and a new `<SectionRenderer>` that no
screen imports yet. Mobile ships only via OTA, which is NOT done here; the live
Home is untouched until a deliberate, gated cutover.

## Release classification
- **Foundation commit (this one):** `Packages/Mobile/src/**` but **inert** — no
  OTA, default-off flag, unimported component. `released=false`. Committing/pushing
  it does not reach any device (mobile updates only via OTA).
- **Cutover (separate, later):** flag-on + `pnpm publish-ota:all` =
  production-impacting → explicit founder go; before/after-diff + Maestro first.

## What changes (foundation)
- New: `config/featureFlags.js`, `components/SectionRenderer.js`.
- Edited: `services/api.js` (one additive method). No existing call path altered.
- `HomeScreenV2` is **not** edited in the foundation commit (the riskiest change —
  the live screen — is deferred to the flag-gated wiring step with full diff +
  Maestro).

## What is NOT disturbed
- The current hardcoded Home path, all other follower screens, brand/influencer
  apps, web, backend — untouched.
- Phase A backend — consumed read-only; no change.

## Risks + mitigations
- **Card-prop mismatch in SectionRenderer** → reuses the exact prop shapes
  `HomeScreenV2` already passes to ProductCard/NewOfferCard/InfluencerStoryRow/
  CategoryGrid; caught visually by the before/after-diff at cutover.
- **Cutover regression** → flag default-off + automatic fallback to the hardcoded
  path on `/home` error/empty; flip is reversible (flag off + OTA).
- **OTA bundles Window B WIP** → `publish-ota:all` bundles the working tree;
  surface to founder before any OTA (memory: ota-publish + parallel-window git).

## Parallel-window git hygiene
Phase C foundation touches ONLY: `features/follower-section-home/**`,
`Packages/Mobile/src/config/featureFlags.js`, `Packages/Mobile/src/services/api.js`,
`Packages/Mobile/src/components/SectionRenderer.js`. Stage by path; never
`git add -A`. Do not branch (shared checkout).
