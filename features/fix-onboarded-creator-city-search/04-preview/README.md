# Preview (Step 4) — fix onboarded-creator city search

No UI. Forward-only DB-view migration. Reviewer note + result.

## Reviewer note (Step-5 lock)
- **PRODUCTION-IMPACTING** (migration → Render). Founder GO
  2026-05-19 ("This is required pls fix this").
- `CREATE OR REPLACE VIEW` (migration 055), onboarded branch
  `i.city`→`u.city` only; scraped branch + all other columns
  byte-identical to 045; same output column order (required).
- Resolves carve `backend-defect-onboarded-creator-city-search`;
  catching test flips by the migration only.

## Step 7 — RESULT — GREEN 2026-05-19 (RELEASED)
```
fix        : migrations/055 — v_searchable_creators onboarded
             u.city AS city (was i.city)
qa:db      : GREEN — _fix6_remeasure_qadb.log 17:20:36Z:
             54/54 migrations 0-error (true count, not the
             predicted 55/55); '√ filters by city (case-
             insensitive)' RED→GREEN; other search GREEN;
             382/382. (was env-blocked at handoff — now proven)
main pnpm qa: GREEN — 66 passed, C1 STATE=GREEN, gate 0
deploy     : PRODUCTION-IMPACTING (Render migration) — surfaced;
             founder GO
carve      : backend-defect-onboarded-creator-city-search →
             resolved on green
```
