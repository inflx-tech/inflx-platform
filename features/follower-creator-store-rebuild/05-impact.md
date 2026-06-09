# Impact — Follower Creator Store rebuild

## Terse verdict
**Zero backend/data change — one mobile screen's layout + interactions.** Reads the
existing `getStore` endpoint; reversible via OTA.

## What changes mechanically
- `InfluencerStoreScreen.js` rewritten to the mockup: top bar, gradient-ring hero with
  3 counters + Follow/Share + bio, My Store Collabs (distinct brands), sticky category
  tabs (filter), What {creator} Promotes + Top Picks 🔥 (vibe DealCard rails). All derived
  client-side from `getStore(handle)` → `{ influencer, offers }`.
- Removed: the older category-grid + hot-picks list + the section-engine fallback path.

## Blast radius
- Mobile follower OTA only. NATIVE_RUNTIME unchanged ('3') → no APK. No backend, no money
  path. 4-ID tracking forwarded unchanged on tap.
- Risk = visual/interaction only (built blind to a device); founder is the acceptance gate;
  rollback = revert + re-publish.

## Open / deferred
- Store-context purchase attribution (pass via_store_influencer_id from picks bought here)
  — the money slice, wired separately + tested live.
- Counters: "picks" = offer count, "collabs" = distinct brands (derived). If the store
  endpoint later returns exact picks/collabs counts, swap them in.
- Maestro not runnable in sandbox → release waives the maestro gate via GOVERNANCE_OVERRIDE.
