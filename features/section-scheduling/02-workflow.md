# Workflow Definition — Section scheduling + config validation

> Step 3. Each numbered step becomes an assertion in the QA workflow test.

## Actor
Admin (any admin role) with a valid JWT, calling the REST API directly (no UI
in this contract — the App Builder wizard exposes the fields in P2).

## Preconditions
- `section_config` has the 124 columns applied.
- A test screen scope (e.g. `category` / vertical `food`) with at least one
  existing enabled shelf (the regression baseline).

## Workflow steps (user-observable)
1. Admin PUTs a shelf with `starts_at` in the past, `ends_at` in the future →
   200; GET returns the shelf with both fields; follower section endpoint for
   that scope INCLUDES the section.
2. Admin PUTs a shelf with `ends_at` in the past → 200 (saving history is
   legal); follower section endpoint EXCLUDES the section (disappears, no
   placeholder).
3. Admin PUTs a shelf with `starts_at` in the future → follower endpoint
   EXCLUDES it now (goes live later, automatically).
4. Admin PUTs a shelf with `ends_at` ≤ `starts_at` → 422 VALIDATION_ERROR,
   field `ends_at`, nothing persisted (transaction intact).
5. Admin PUTs a shelf with `starts_at: "not-a-date"` → 422, field `starts_at`.
6. Admin PUTs a `tiles` shelf with `config_json.style = "bogus"` → 422, field
   `config_json.style`.
7. Admin PUTs `config_json.tap_destination = { type: "page" }` (no page_key)
   → 422, field `config_json.tap_destination.page_key`.
8. Admin PUTs a shelf with NO dates and an arbitrary unknown config key
   (e.g. `{"kind":"menu"}`) → 200, key round-trips unchanged (raw-JSON editor
   compatibility).
9. Shelf with `ends_at` set + `config_json.timer = {}` → follower payload's
   section carries `config.timer.ends_at === row.ends_at` (honest timer).

## Success definition
The workflow is SUCCESSFUL only if: scheduled-out sections are absent from the
follower `sections[]` payload with zero code deployed to mobile; in-window
sections are present with `starts_at`/`ends_at` on the wire; every invalid
write in steps 4–7 is rejected 422 with the named field and the DB row is
unchanged; step 8 proves no over-validation regression.

## Failure / edge workflows
- Existing rows (both dates NULL) → included exactly as before (regression:
  the pre-existing shelf from Preconditions still renders through every step).
- Scheduled-out override row (scope_type=vertical) → its global base row
  reappears (documented merge semantics).
- Legacy row whose stored config would fail today's validation → read path
  still serves it; only a WRITE re-triggers validation.
