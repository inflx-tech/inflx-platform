# Workflow — Phase C2 (discovery screens on the engine)

## Build sequence (per screen, incremental)
1. Add a per-screen flag (default false) in `config/featureFlags.js`.
2. Add the `followerApi` method for the screen's section endpoint.
3. Flag-gate the screen body: on → `<SectionRenderer>` with the engine sections,
   with a fallback to the existing body on error/empty; off → unchanged.
4. babel-transform every touched file; keep the existing path intact.

This increment: **Creator Store** (`InfluencerStoreScreen`, `SECTION_ENGINE_CREATOR`).

## Verification
- babel transform on all touched Mobile files (compile check).
- `pnpm qa` GREEN (web; backend unchanged — zero regression).
- `<SectionRenderer>` already verified on-device for Home (same component);
  Creator Store reuses it. `/section/creator/:handle` covered by Phase A API tests.
- On-device visual proof + Maestro at the released=true flip (cutover step).

## Release classification
- **This commit:** `Packages/Mobile/src` but **inert** — default-off flag +
  additive api methods + a guarded body swap; ships to devices only via OTA,
  which is NOT performed here. `released=false`.
- **Cutover (later, per screen):** flip flag → before/after-diff + Maestro → OTA =
  production-impacting → explicit founder go; `publish-ota` bundles the working
  tree (Window B WIP) — flag before OTA.
