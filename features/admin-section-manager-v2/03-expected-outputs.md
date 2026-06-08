# Expected Outputs — admin-section-manager-v2 (Part A)

## Files (Part A)
- `Packages/brand-web/app/admin/sections/page.js` — rewritten with: scope selector,
  inline title edit, config editor (caption / chip-filter labels / nav-vertical
  labels+icons / advanced JSON), ＋ Add Section presets.

## Acceptance checks (Part A)
1. **Rename:** editing a shelf title + Publish persists (reload shows new title;
   follower app shelf header updates within ~60s).
2. **Config:** caption + chip/filter labels + vertical labels/icons editable;
   advanced JSON validates (invalid JSON not applied). Publish persists.
3. **Add Section:** a preset adds a valid new shelf; Publish inserts it (appears on
   reload + in the follower app).
4. **Scope:** switching to City/Vertical loads that scope; Publish writes the
   override; Global unaffected.
5. **Existing controls** (reorder/toggle/count/type/delete) still work.
6. `pnpm qa` GREEN (admin nav-sweep + role-gate specs unaffected).

## Release classification
- **production-impacting** (Vercel — brand-web admin). Auto-deploys on push. No
  migration, no OTA. UI-governed (Packages/brand-web/app) → mockup_locked +
  06-diff required; Maestro Rule 5 not triggered (not Mobile/src).

## Part B (separate)
Greeting + admin-curated chips — migration 091 + app read + OTA. Tracked, built next.
