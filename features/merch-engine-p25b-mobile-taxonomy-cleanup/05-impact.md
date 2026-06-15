# Impact — Mobile taxonomy cleanup (Phase 2.5b)

**Terse verdict:** Tiny client wiring on top of 2.5a. Zero backend/DB/API change. The
only visible delta is the Food tile rendering the EXISTING dining layout (reuse, not new
design). Registration value + offline fallback alignment are invisible. Low risk.

## Blast radius
- 4 files: 2 registration (mobile + web), 2 follower (CategoryGrid fallback, CategoryListScreen layout dispatch).
- Mobile → OTA; brand-web → Vercel. No native change, no migration, no backend.

## What could break + mitigation
- *Old cached payload with legacy keys* → SUPERCAT_ACCENT keeps legacy keys; backend 2.5a
  alias resolves them. No break.
- *Food layout* → routes to the existing, proven dining layout (used by restaurants today);
  not a new code path.
- *Registration* → value-only change; label unchanged; schema resolution already aliases.

## Reversibility
- Pure git revert of 4 files + re-publish OTA. No data involved.

## Why no new mockup
- No new visual design: Food reuses the existing dining layout; fallback list rarely
  renders; registration is value-only. Founder approved the scope (defer the one screen
  that *would* change visually — FindScreen — to Phase 5). 06-diff/notes.md records the
  before/after in words.

## Deploy classification
**Production-impacting** (mobile OTA + brand-web) → explicit founder go. released=false
until founder verifies (so Maestro gate not triggered this cycle).
