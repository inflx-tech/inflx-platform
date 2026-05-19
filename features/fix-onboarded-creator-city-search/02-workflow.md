# Workflow — fix onboarded-creator city search

> Step 2. Verifier: `pnpm qa:db` (carved RED test → GREEN by the
> migration) + main `pnpm qa` regression.

## Preconditions
Carve `backend-defect-onboarded-creator-city-search` open RED.
Full 045 view definition captured; only the onboarded `city`
source changes. Founder GO 2026-05-19.

## Steps
1. Add `backend/migrations/055_fix_v_searchable_creators_
   onboarded_city.sql` (CREATE OR REPLACE VIEW; onboarded
   `i.city`→`u.city`; everything else byte-identical to 045).
2. `pnpm qa:db`: globalSetup applies all 55 migrations 0-error;
   `'filters by city (case-insensitive)'` RED→GREEN; all other
   influencer-search tests stay GREEN; no regression vs the
   post-P12 baseline; no new 500s.
3. main `pnpm qa`: 66 GREEN / C1 / gate 0.
4. Step-14 RELEASE — PRODUCTION-IMPACTING, surfaced explicitly;
   commit with this approved contract; push → Render migration.
5. Close the carve (mark resolved, link this fix commit).

## Success definition
The catching test passes via the MIGRATION only (no test edit);
migrations 55/55 0-error; scraped-branch + other search filters
unaffected; zero main-lane regression; deploy surfaced.

## Failure / edge
- Migration error / view column-order mismatch → CREATE OR
  REPLACE fails loudly in globalSetup → fix the SQL, never
  partial.
- Test still RED → reclassify, verify-twice, do not force.
