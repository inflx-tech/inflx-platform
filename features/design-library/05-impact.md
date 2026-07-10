# Impact — Design Library (Phase 3)

**Verdict (one line): additive and read-only — one new table + seeded layouts + two read-only admin endpoints + one admin screen. No existing surface changes; does NOT touch the current live section engine.**

## Mechanics
- **DB:** new `design_layouts` (migration ≥131) + seed of 10 layouts (≥132). `CREATE TABLE IF NOT EXISTS`, idempotent. Existing tables untouched. Deploy-inert until read by the new screen / the Phase-4 renderer.
- **Backend:** new `adminDesignLayouts.controller.js` + routes, `requireCapability('sections')`. Section styles are a static vocabulary served from a constant. No change to any existing controller/route/service — in particular the live `sectionEngine`/`sectionRules` are untouched.
- **Web (brand-web):** new page `app/admin/design-library/page.js`. New nav entry. No change to existing admin pages. **UI-governed** → mockup-lock + before/after diff gates apply.
- **Mobile / follower / engine:** untouched. (The Adaptive Renderer that *consumes* these contracts is Phase 4.)
- **Money/attribution/status machines:** none.

## Risk
- Lowest tier — read-only reference data. Nothing renders from it yet.
- Contracts are seeded content transcribed from the locked `02_LAYOUT_CONTRACTS.md`; a wrong slot is an edit, not a defect.

## Dependencies
- None hard. Complements Phase 1 (presets) + Phase 2 (themes); consumed by Phase 4 (renderer) + Phase 5 (templates).

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- Migration + backend + brand-web: **production-impacting** → pushed only on founder's explicit go (never silent).
