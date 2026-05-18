# Impact Analysis — Admin role-gate matrix

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/web/admin/role-gate.spec.ts`
- **Reused as-is:** `qa/web/_helpers/adminSession.ts`
  (`seedAdminSession`, `stubAdminApis` for M4 + queue counter).
- **Read, not changed:** `Packages/brand-web/middleware.js`,
  `app/admin/layout.js`.
- **No application code changes.** No migration, mobile, OTA.
- Playwright config: no change.

## Affected routes / APIs
None under test. `/admin/queue/*`, `/admin/stats`, `/auth/refresh`
stubbed only so M4 (valid admin) can render; negative rows never
reach them (M1 by server redirect; M2/M3 redirect client-side).

## Affected workflows (regression surface)
- This spec *is* the regression net for the gate itself. Any change
  to `middleware.js` or `app/admin/layout.js` must keep all 5 matrix
  rows green. Complements A1/A3 (which assume the gate works).

## Migration / deploy / OTA impact
- None. `test(qa)`-class, deploy-inert.

## Risk notes
- M2/M3 assert **final URL only** (client redirect is inherently
  racy vs. the page's own fetch) — deliberate, documented in the
  workflow doc. Not a weak assertion: the URL *is* the security
  outcome.
- Known, intentionally-untested limitation: middleware checks cookie
  *existence* only (no signature/role). Recorded in 01-spec so it is
  not mistaken for a coverage gap; true token enforcement is a
  backend concern (Area B / separate contract), not this gate.
- No new selectors beyond A1's ("Approval Queue" heading) → low
  brittleness.
