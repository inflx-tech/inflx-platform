# Impact — follower-page-builder

**Verdict:** additive across all three layers; zero functional disturbance to
existing flows when `tap_destination` is unset (the default for every section
today). The one schema change is an additive CHECK widening.

## Surface
- **Migration NNN (prod-impacting):** `CREATE TABLE follower_pages` (new) +
  `ALTER … section_config` CHECK to add `'page'` to `screen`. Additive only; no
  data backfill, no column drop, no rewrite of existing rows.
- **Backend `src/**` (prod-impacting):** new admin pages CRUD routes/controller;
  new follower read route `/follower/page/:key/sections` (thin wrapper over the
  existing `sectionEngine.buildSections`); `tap_destination` passes through the
  existing `config_json` plumbing untouched. No change to existing controllers'
  behavior.
- **Admin brand-web `app/**` (prod-impacting via Vercel):** new `/admin/custom-pages`
  page; "Custom page" scope tab + "On tap, go to…" control added to `/admin/sections`.
  Existing scopes/editor untouched when the new control is left Default.
- **Mobile `src/**` (OTA, no APK):** new `FollowerPageScreen` + nav route +
  `getPageSections` api method; `SectionRenderer` gains a destination check ahead
  of the existing type-based route. Cards' detail nav unchanged.

## Risk register
- **Regression risk:** low. Sections without `tap_destination` hit the unchanged
  fallback path; `pnpm qa` GREEN 79 must hold and is the gate.
- **CHECK widening:** safe — additive enum value, existing values still valid.
- **Dangling page reference:** handled — deleted/disabled page → empty state, no crash.
- **Recursion:** a page can host sections pointing at other pages; bounded by user
  taps (no auto-loop), same as any nav stack.

## Deploy classification
Production-impacting (migration + backend + Vercel admin + mobile OTA). Step-gated
per founder rhythm: **migrate → verify → backend/admin deploy → verify → OTA → verify.**
release.released stays false (no Maestro).
