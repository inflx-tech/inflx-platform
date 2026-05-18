# Impact Analysis — Admin navigation sweep

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/web/admin/nav-sweep.spec.ts`
- **Additive to helper:** `qa/web/_helpers/adminSession.ts` gains a
  new exported `stubApiPermissive(page)` (catch-all `**/v1/**` →
  benign envelope). Purely additive — existing exports
  (`seedAdminSession`, `stubAdminApis`, `shotDir`) unchanged, so
  released A1/A2/A3 specs are unaffected (no churn).
- **Read, not changed:** `app/admin/layout.js` + 18 page.js.
- No application code. No migration, mobile, OTA. No config change.

## Affected routes / APIs
- 18 admin GET routes navigated read-only. All `**/v1/**` calls
  stubbed permissively — **no mutations, no marketing-engine
  workflows triggered** (GET navigation only; aligns with the
  marketing-engine autonomy boundary).

## Affected workflows (regression surface)
- This spec is the breadth net for every admin page. It overlaps
  intentionally with A1/A2/A3 on `/admin/approvals` (shallow check
  there; deep checks remain in A1/A3) — not a conflict.
- Failure modes it will catch: NAV/route drift (404), gate
  regression (redirect), render-on-empty crash.

## Migration / deploy / OTA impact
- None. `test(qa)`-class, deploy-inert.

## Risk notes
- **v0.3.0 scoping:** assertion (c) "no uncaught page error" removed
  — a uniform stub cannot satisfy array- AND object-shaped endpoints,
  so (c) was an unsound per-endpoint check inside a breadth net. The
  3 routes that genuinely crash on a realistic empty payload
  (`/admin/analytics`, `/admin/marketing/leads`,
  `/admin/marketing/funnel`) are tracked as real findings in
  `features/admin-data-robustness/` (A5b) → app-code micro-contracts.
  Not hidden, not suppressed — relocated to a contract that can
  assert them soundly (per-endpoint fixtures / real fix).
- **v0.2.0 correction:** the permissive stub now returns `data:[]`
  (was `data:{}` in v0.1.0). The original shape produced 6 FALSE
  failures because an empty object short-circuits the pages'
  `res.data?.<key> || res.data || []` fallback into a non-array —
  proven a stub defect, not an app defect, because `/admin/approvals`
  (green in A1 with realistic data) failed only under the bad stub.
  `data:[]` is the realistic empty contract. Pages that destructure
  with NO fallback (`res.data.x.map`) still throw — that remains a
  **wanted** signal and becomes its own follow-up micro-contract
  (don't weaken further to hide a genuine one).
- Selector "INFL" is the layout brand mark — present on every admin
  page via the shared layout; low brittleness. `.first()` guards
  against the logo appearing twice.
- 18 lightweight cases (goto + 3 asserts, no actions) → fast, runs
  in the existing web-brand project; no parallelism concerns.
