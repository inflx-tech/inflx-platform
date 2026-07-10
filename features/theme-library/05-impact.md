# Impact — Theme Library (Phase 2)

**Verdict (one line): additive — one new table + seeded blueprints + six admin endpoints + two admin screens (list + wizard). No existing surface changes; the only writes are to the new `experience_themes` table.**

## Mechanics
- **DB:** new `experience_themes` (migration ≥129) + blueprint seed (≥130). `CREATE TABLE IF NOT EXISTS`, idempotent. Existing tables untouched. Deploy-inert until an admin authors/publishes.
- **Backend:** new `adminThemes.controller.js` + `theme.service.js` + routes, registered under `/v1/admin/themes` with `requireCapability('sections')`. Reuses Phase-1 presets endpoint + existing category/offer references (read-only). No change to any existing controller/route/service.
- **Web (brand-web):** new pages `app/admin/themes/` (list) + the Configuration wizard. New nav entry. No change to existing admin pages. **UI-governed** → mockup-lock + before/after diff gates apply.
- **Mobile / follower / engine:** untouched.
- **Money/attribution/status machines:** none.

## Risk
- Low. Themes are inert until Phase 5 templates + Phase 6 experiences consume them; nothing on the follower app reads `experience_themes` yet.
- Publish-validation is server-side (not just UI) so a theme can't go live under-specified.
- Blueprint seed is content; a wrong pre-fill is an edit, not a defect.

## Dependencies
- Phase 1 `design_presets` (live in prod ✓) — the wizard's Visual step references them.
- Existing world-category + offer-type data (read-only).

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- Migration + backend + brand-web: **production-impacting** → pushed only on founder's explicit go (never silent).
