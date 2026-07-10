# Impact — Design System & Tokens (Phase 1)

**Verdict (one line): zero functional disturbance — purely additive (two new tables + two read-only admin endpoints + one new admin screen). No existing surface changes.**

## Mechanics
- **DB:** new `design_tokens`, `design_presets` (migration ≥127). `CREATE TABLE IF NOT EXISTS`, idempotent, touches no existing rows. Deploy-inert until seeded.
- **Backend:** new `adminDesignSystem.controller.js` + routes, registered under the admin router with `requireCapability`/`requireAnyAdminRole` (matches adminSectionLibrary). No change to any existing controller/route/service.
- **Web (brand-web):** new page `app/admin/design-system/page.js`. New nav entry. No change to existing admin pages. **UI-governed** → mockup-lock + before/after diff gates apply.
- **Mobile / follower / engine:** untouched.
- **Money/attribution/status machines:** none touched.

## Risk
- Lowest tier. Worst case if migration un-run: the new screen shows empty-state (no crash), everything else unaffected.
- Seed values are content; wrong hex is a cosmetic fix, not a functional defect.

## Release classification
- Contract + docs + mockups here: **deploy-inert**.
- Migration + backend + brand-web page: **production-impacting** → surfaced explicitly, pushed only on founder's explicit go (never silent).
