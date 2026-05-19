# Impact Analysis — backend-defect-open-group-publish-assignment-mode-mismatch

## Deploy posture
- **This carve: DEPLOY-INERT.** Adds only this
  `features/backend-defect-*/` finding; the catching test
  (`tests/negotiations.test.js` `'publishes the open-group set
  and returns 200'`) is left RED. No backend/runtime edit. No
  Render/Vercel.
- **The future fix: PRODUCTION-IMPACTING.** Edits backend
  runtime (`offer.controller.js publishOpenGroup` and/or
  `campaign.controller.js createSet`/`updateSet`, possibly a
  backfill migration) → Render → explicit Step-14 gate (never
  silent). Tracked, not done here.

## Affected (future fix, not this carve)
- `backend/src/controllers/offer.controller.js:835`
  (`publishOpenGroup` reads `set.assignment_mode`).
- `backend/src/controllers/campaign.controller.js:478-489`
  (`createSet` writes `influencer_mode`, not `assignment_mode`)
  and `:512` (`updateSet` allowed list uses `influencer_mode`).
- `campaign_sets` dual columns: `assignment_mode` ENUM
  (migrations/001:221) vs `influencer_mode` varchar
  (migrations/002:12). A backfill of existing rows may be
  needed depending on which column is made canonical.
- Catching test: `tests/negotiations.test.js`
  `'publishes the open-group set and returns 200'` (RED now;
  GREEN only via the backend fix).

## Regression surface (future fix)
- `'returns 422 when set is not open_group'` must stay GREEN
  (a handpick set must still be 422'd by publish-open).
- Any other code reading `assignment_mode` vs `influencer_mode`
  must be audited for the same split (open-group matching,
  invite/assignment flows) — scope to confirm in the fix
  contract.
- `setupOpenGroupScenario` (P11 class-2 `set_budget` fix) is
  unrelated and stays.

## Risk notes
- Medium-risk fix: choosing the canonical column affects all
  open-group code paths; needs an audit + possibly a data
  backfill. The carve exists so this gets an explicit,
  gated decision rather than a silent test edit.
- Source: Phase-11 triage (`features/backend-test-debt-phase11`),
  P11 deterministic re-measure on the real 53-migration qa:db
  Postgres (2026-05-19). Reproduced deterministically (Expected
  200, Received 422 after the fixture gap was corrected).
