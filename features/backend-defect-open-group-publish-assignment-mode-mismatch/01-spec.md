# Backend Defect — open-group publish always 422 (`assignment_mode` vs `influencer_mode` column split)

> Status: **CARVED FINDING** (Phase 11, 2026-05-19). GENUINE
> BACKEND DEFECT. Catching test LEFT RED. Backend NOT patched
> here — the fix is its own future contract (production-
> impacting: backend runtime, gated).

## Symptom
`POST /v1/campaigns/:id/sets/:sid/publish-open` returns **422
VALIDATION_ERROR** for a set the brand created as open-group —
so an open-group campaign set can **never** be published via
the publish-open endpoint. Catching test:
`tests/negotiations.test.js`
`'POST /v1/campaigns/:cid/sets/:sid/publish-open › publishes
the open-group set and returns 200'` — expects 200, gets 422.
Left **RED**.

## Why it is a genuine backend defect (verify-twice, real code + schema + instrumented)
- `campaign_sets` has **two** mode columns:
  - `assignment_mode` ENUM('handpick','open_group') —
    `migrations/001_initial_schema.sql:221` (no DEFAULT → NULL).
  - `influencer_mode` varchar(20) DEFAULT 'handpick' — added
    later by `migrations/002_add_missing_columns.sql:12`.
- `createSet` (`campaign.controller.js:478-489`) INSERTs the
  mode into **`influencer_mode`** only
  (`influencer_mode || 'handpick'`). It never writes
  `assignment_mode` → `assignment_mode` stays **NULL** for every
  API-created set, regardless of the request body
  (`assignment_mode:'open_group'` in the body is ignored;
  `updateSet`'s allowed list also uses `influencer_mode`, not
  `assignment_mode` — `campaign.controller.js:512`).
- `publishOpenGroup` (`offer.controller.js:835`) gates on
  **`set.assignment_mode !== 'open_group'`** → always true
  (NULL ≠ 'open_group') → **always 422** for every set.
- Net: open-group publishing is non-functional end-to-end. The
  dual-column split introduced by migration 002 was never
  reconciled between the write path (`createSet` →
  `influencer_mode`) and this read path (`publishOpenGroup` →
  `assignment_mode`).
- Instrumented/measured (P11 deterministic re-measure, real
  qa:db PG): with the open-group set-create fixture corrected
  (`set_budget` added — a real, separate class-2 gap),
  publish-open still returns **422** (Expected 200) — confirming
  the failure is the column mismatch, not the fixture.

## Disposition (Phase 11 = triage + carve, NOT backend-fix)
- The catching test stays **RED**. P11's class-2 fixture fix
  (`setupOpenGroupScenario` + `set_budget`) is correct and
  retained — it lets the setup create the set + publish the
  campaign, so the test now fails on the **genuine**
  publish-open 422 (exposes the defect), not a stale setup
  TypeError. No assertion weakened/skipped; backend NOT patched.
- The sibling test `'returns 422 when set is not open_group'`
  is GREEN and left as-is: rejecting a handpick set with 422 is
  the *correct* outcome (it happens to also be 422 here for the
  same underlying NULL reason, but a handpick set SHOULD be
  422'd by publish-open — that test asserts a correct rule and
  is not masking anything actionable differently).

## Scope of the future fix contract (not done here)
Reconcile the dual column. Minimal candidates (product/eng to
confirm the canonical column):
- `publishOpenGroup` read `set.influencer_mode` instead of
  `set.assignment_mode`; OR
- `createSet`/`updateSet` also persist `assignment_mode` (and
  backfill existing rows) so the ENUM column is authoritative.
Backend runtime change → production-impacting → explicit
Step-14 gate, never silent. Verify: `pnpm qa:db` this RED test
→ GREEN by the backend fix (not a test edit) + the sibling
handpick-422 test still GREEN + main `pnpm qa` regression.

## Surfaces
- Defect lives in backend runtime
  (`campaign.controller.js createSet` / `offer.controller.js
  publishOpenGroup` / the `campaign_sets` dual-column schema).
  The future fix is **production-impacting** (Render). This
  carve itself is **deploy-inert** (a tracked finding + RED
  test only).
