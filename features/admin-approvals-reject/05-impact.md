# Impact Analysis — Admin approvals: reject with a reason

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):**
  - `qa/web/admin/approvals-reject.spec.ts`
  - `qa/web/_helpers/adminSession.ts` — shared admin seed + API
    stubs, extracted from the A1 pattern (cookie + localStorage +
    5 route stubs). New file; no behaviour change.
- **Read, not changed:** `app/admin/approvals/page.js`,
  `app/admin/layout.js`, `middleware.js`, `lib/api.js`.
- **No application code changes.** No migration. No mobile. No OTA.
- Playwright config: no change (testMatch already covers
  `web/**/*.spec.ts`; admin served by brand-web:3002).

## Affected routes / APIs (observed; stubbed)
| Method | Path | Change | Notes |
|---|---|---|---|
| PATCH | /admin/brands/:id/status | none | now also asserted with `status:'rejected'` + `rejection_reason` |
| GET | /admin/queue/brands, /admin/queue/influencers | none | queue load |
| GET | /admin/stats · POST /auth/refresh | none | layout cold-start |

## Affected workflows (regression surface)
- Shares the `/admin/*` auth path and `adminApi` with A1 and every
  admin page. The new shared helper centralises that setup.
- **A1 left as-is** (released artifact). De-duplicating
  `approvals.spec.ts` onto the new helper is an OPTIONAL future tidy
  with its own tiny change — not bundled here (no churn on a
  released spec).

## Migration / deploy / OTA impact
- None. Test + helper + contract docs only. `test(qa)`-class,
  deploy-inert.

## Risk notes
- Deterministic (seeded + stubbed); no live backend, no DB writes.
- Selector risk: reason chips/textarea are class-styled, no testids.
  Spec targets visible text ("Select rejection reason", reason
  labels, "Confirm Reject", "rejected successfully"). If brittle,
  the follow-up (adding `data-testid`s to `approvals/page.js`) is an
  app-code change → its own micro-contract.
