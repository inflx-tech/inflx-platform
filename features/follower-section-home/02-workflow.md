# Workflow — Follower Home on the Section Engine (Phase C)

> No runtime code reaches devices until an OTA; OTA is surfaced for explicit go.

## Build sequence
1. **Foundation (inert, this commit):**
   - `config/featureFlags.js` — `SECTION_ENGINE_HOME: false`.
   - `services/api.js` — `followerApi.getHomeSections(loc)`.
   - `components/SectionRenderer.js` — new component (not yet imported by any
     screen → zero runtime effect on arrival).
2. **Wiring (next step, flag-gated):**
   - `HomeScreenV2` branches on `SECTION_ENGINE_HOME`: on → fetch `/home` +
     render `<SectionRenderer>` with a fallback to the hardcoded path on
     error/empty; off (default) → unchanged.
3. **Cutover (separate, gated):** flip the flag on for an internal build →
   before/after-diff vs `home-comprehensive.html` → `pnpm qa` + `pnpm qa:maestro`
   → founder OTA go → `pnpm publish-ota:all` (flag on). Roll back = flip flag off
   + OTA.

## Verification
- `node -e "require('@babel/core').transformFileSync(...)"` (babel transform) on
  every touched Mobile file — must compile.
- Integrity greps: 0 orphaned tokens; the existing hardcoded Home path preserved
  (flag-off branch intact).
- `pnpm qa` GREEN (web unaffected; backend unchanged).
- At the released=true flip only: `pnpm qa:maestro` green (gov-check Rule 5).

## Release classification
- **This (foundation) commit:** Packages/Mobile/src code, but **inert** — new
  unimported files + a default-off flag + an additive api method. Ships to devices
  only via OTA, which is NOT performed here. `released=false`.
- **Cutover commit (later):** flips the flag + OTA = production-impacting →
  explicit founder go; never silent. NOTE: `publish-ota:all` bundles the WORKING
  TREE, so it would also bundle Window B's uncommitted WIP — flag to founder before
  any OTA.
