# Impact — Adaptive Renderer (Phase 4)

**Verdict (one line): additive — no new tables, one read-only preview endpoint + a pure render-decision module (4a), and a new mobile renderer component + dev preview screen (4b). Nothing on the live follower home changes; the current section engine is untouched.**

## Mechanics
- **DB:** none. Reads existing Phase 1-3 tables (presets/tokens/themes/layouts).
- **Backend (4a):** new `renderSpec.service.js` (pure `resolveRenderSpec`) + `adminExperiencePreview.controller.js` + route, `requireCapability('sections')`. Synthesizes a sample pack from constants. No change to any existing controller/route/service — the live `sectionEngine`/`sectionRules` are NOT touched.
- **Mobile (4b):** new `AdaptiveRenderer` component + an admin/dev **Experience Preview** screen under `Packages/Mobile/src`. No change to existing follower screens or the current `SectionRenderer` (the two coexist; the follower home keeps rendering exactly as today until Phase 5 wires templates in). **Mobile-governed** → mockup-lock + Maestro gate + before/after diff.
- **Follower / money / attribution:** untouched.

## Risk
- 4a: low — pure logic, fully unit-testable; read-only endpoint.
- 4b: medium — new RN rendering code, but isolated behind a dev preview screen; it does not alter the live follower experience. Worst case if buggy: the preview screen looks wrong; nothing user-facing regresses.
- Sample pack is placeholder; wrong sample data is cosmetic.

## Dependencies
- Phase 1 (presets/tokens ✓ live), Phase 2 (themes ✓ live), Phase 3 (layouts/contracts ✓ live).
- 4b Maestro gate needs a connected Android device/emulator (`pnpm qa:maestro:doctor`).

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- 4a (backend): **production-impacting** (backend deploy) → explicit go.
- 4b (mobile): **production-impacting** (OTA bundle) + **Maestro-gated** → explicit go; the preview screen is dev/admin-only so it does not change the public app.
