# 06-diff — Follower Home on the Section Engine (Phase C)

## Commits so far — no visual change on devices yet

**Foundation commit (1bbc0c4):** featureFlags (default off) + getHomeSections +
SectionRenderer (unimported). Inert.

**Wiring commit (this):** `HomeScreenV2` now branches on `SECTION_ENGINE_HOME` —
flag ON → fetch `/home` + render `<SectionRenderer>` (fallback to the hardcoded
path on error/empty); flag OFF (default) → the hardcoded path is byte-identical
to before. Still NO OTA, so devices are unaffected. With the flag off there is no
before/after delta to capture.

The visual diff vs `home-comprehensive.html` is produced at the **cutover step**,
when `SECTION_ENGINE_HOME` is flipped on for an internal build and Maestro
screenshots the new Home — done before the OTA, with the founder's go.

## ON-DEVICE VERIFICATION DONE (2026-06-03) — `06-diff/after/`

Built a `followerDebug` APK from the working tree, flipped `SECTION_ENGINE_HOME`
on locally, pointed the dev app at PROD, and Maestro-captured the Home on
emulator-5554:

- **`after/home-section-engine-rendered.png`** — the new Home renders from the
  live `/v1/follower/home` payload via `<SectionRenderer>`: the Creator Vibe
  header ("DEALS NEAR YOU · Vijayawada"), search bar, and the **"Browse by
  Category"** shelf showing the **7 seeded verticals (Eat · Shop · Groom · Stay
  Fit · Travel · Home · Events)** straight from `section_config.config_json`.
  PROOF the backend→engine→renderer→device pipeline works end-to-end.
- **`after/home-fallback-empty-state.png`** — with no backend reachable, the
  screen safely falls back to the hardcoded "No deals yet" path (never blank).

Other shelves (stories / what's-hot / deals) render empty because PROD currently
has sparse live-offer data — correct behavior (empty shelves render nothing).

### Cutover readiness (why the flag stays OFF for now)
The render is proven, but the OTA flip is **held** for two product reasons, not
code reasons:
1. **Sparse prod data** — until there are live offers + admin curation (via the
   now-live Section Manager, Phase B), the engine Home would look barer than the
   current hardcoded Home. Flip once prod has data worth showing.
2. **OTA bundles the working tree** incl. Window B's WIP — flip + `publish-ota`
   when Window B is shippable.

Flipping = set `SECTION_ENGINE_HOME: true` → `pnpm qa:maestro` → OTA. Reversible
(flag off + OTA).

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
