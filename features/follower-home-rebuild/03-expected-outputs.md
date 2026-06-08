# Expected Outputs — follower-home-rebuild

> Step 4. Concrete, checkable end states.

## Files changed
- `Packages/Mobile/src/components/SectionRenderer.js` — rewritten to render via
  `components/vibe`; Eat re-pointed; nav targets + `hasEngineContent` + controls/
  hero/grid preserved.
- `Packages/Mobile/src/screens/follower/HomeScreenV2.js` — header (location +
  avatar + bell) + serif greeting + search filter; fallback Eat route fixed.
- Contract docs + `04-preview/` (capture.json) + `06-diff/notes.md`.

## Acceptance checks
1. **Header** matches the mockup: location block, round profile avatar (real
   initial from `inflx_user`, → Profile tab), bell icon; serif greeting + tagline;
   search bar with filter button.
2. **Shelves** render via the vibe kit: gradient-ring stories, round category
   circles, image-hero brand cards, image-hero product cards, serif shelf headers
   with count + type tags; offer rails use DealCard/FeatureCard.
3. **Eat re-point:** tapping Eat (engine path AND fallback) → `CategoryList`
   (`superCategory:'dining'`), never `DiningHome`. `grep` shows no remaining
   `DiningHome` navigate in the Home/SectionRenderer category handlers.
4. **4-ID preserved:** offer/product taps pass `item.tracking`; brand taps pass
   `item.tracking`; no card mutates it.
5. **Backend-first:** no fabricated bell count; brand cards show no rating/distance.
6. **Defensive:** unknown/empty shelves render nothing; other 5 engine screens
   still render (no broken `SectionRenderer` contract).
7. **QA:** babel transform PASS on touched files; `pnpm qa` GREEN (web 79/79 + C1).
8. **Diff:** `06-diff/notes.md` non-empty, side-by-side vs `home-comprehensive.html`.

## Release classification
- **production-impacting** (follower OTA — Home + the shared SectionRenderer
  change ship to the live app). Surfaced explicitly for founder go; `released`
  flips to true only after go + Maestro attest (or recorded `GOVERNANCE_OVERRIDE`
  if the founder can't run the emulator). OTA: `pnpm publish-ota:follower`
  (current follower OTA = v68 → next).
- gov-check expectation at release: Rule 1 (approved contract) + Rule 3
  (mockup_locked) + Rule 4 (`06-diff/notes.md`) + Rule 5 (`maestro_green` when
  `released=true`).
