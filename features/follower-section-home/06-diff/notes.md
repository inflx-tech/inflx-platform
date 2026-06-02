# 06-diff — Follower Home on the Section Engine (Phase C)

## Foundation commit (this) — no visual change yet
This commit lands inert foundation only; it does NOT modify the live Home screen,
so there is no before/after visual delta to capture. The visual diff vs
`home-comprehensive.html` belongs to the **wiring/cutover step**, when
`SECTION_ENGINE_HOME` is flipped on and `HomeScreenV2` renders `<SectionRenderer>`.

What shipped (inert):
- `Packages/Mobile/src/config/featureFlags.js` — `SECTION_ENGINE_HOME: false`.
- `Packages/Mobile/src/services/api.js` — `followerApi.getHomeSections(loc)` (additive).
- `Packages/Mobile/src/components/SectionRenderer.js` — new, not imported by any
  screen yet → zero runtime effect. Maps section `type` → existing card components
  (InfluencerStoryRow · CategoryGrid · NewOfferCard · ProductCard · brand rail),
  reusing the prop shapes `HomeScreenV2` already uses, so the cutover preserves the
  current look.

Mobile ships only via OTA; no OTA is performed in this commit, so devices are
unaffected. `released=false`.

## Cutover step (next, gated)
When `HomeScreenV2` is wired and the flag flipped for an internal build:
`pnpm diff:before follower-section-home` (renders the locked mockup) +
`pnpm diff:after follower-section-home` (Maestro screenshot of the new Home) →
side-by-side review here → `pnpm qa` + `pnpm qa:maestro` → founder OTA go.
