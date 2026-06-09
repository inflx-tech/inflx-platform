# Impact — Follower Offers tab rebuild

## Terse verdict
**Zero functional/data disturbance — one mobile screen's layout + interactions only.**
Reads offer data that is already live; no backend, web, schema, or native change.
Reversible by reverting the screen + re-publishing the OTA.

## What changes mechanically
- `Packages/Mobile/src/screens/follower/DealsScreen.js` fully rewritten to the mockup:
  new chrome (super-category chips + sort/filter pills + located header) and three views
  (All=hero+rails, chip=grid, By-Creator=grouped), all derived client-side from the
  existing `GET /v1/follower/section/offers` payload.
- Old paths removed: brand-category tabs + the `getDeals` grid fallback. Card kit reused
  (`vibe/DealCard`, `vibe/ShelfHeader`, `vibe/Gradient`, `cards/NewOfferCard`).

## Blast radius
- **Mobile follower OTA only.** NATIVE_RUNTIME unchanged ('3') → no APK. No other app,
  no backend, no money path. 4-ID attribution forwarded unchanged on tap.
- Risk = visual/interaction bugs only (built blind to a device); founder is the on-device
  acceptance gate; instant rollback via revert + re-publish.

## Open / deferred
- "Near Me" sort (offers carry no distance yet) — dropped from the pills.
- Admin hero-PIN control (brand-web) — follow-up.
- Store-direct (creator-less) deals omitted from the By-Creator view by design.
- Maestro not runnable in sandbox → release waives the maestro gate via GOVERNANCE_OVERRIDE.
