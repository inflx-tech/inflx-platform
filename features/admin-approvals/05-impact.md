# Impact Analysis — Admin approvals: approve a pending brand

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/web/admin/approvals.spec.ts`
- **Read, not changed:**
  - `Packages/brand-web/app/admin/approvals/page.js`
  - `Packages/brand-web/app/admin/layout.js` (role gate)
  - `Packages/brand-web/lib/api.js` (`adminApi`, base
    `http://localhost:3001/v1`)
- **No application code changes.** No migration. No mobile. No OTA.
- Possible config touch: `qa/playwright.config.ts` may add an
  `web-admin` project (testDir `web/admin`) — additive, low risk.

## Affected routes / APIs (observed; stubbed in test)
| Method | Path | Role | Used by |
|---|---|---|---|
| POST | /auth/refresh | any | admin layout cold-start |
| GET | /admin/stats | admin | sidebar badge |
| GET | /admin/queue/brands | admin | queue load |
| GET | /admin/queue/influencers | admin | queue load |
| PATCH | /admin/brands/:id/status | admin | approve/reject |

## Affected workflows (regression surface)
- Shares the auth/layout path with ALL `/admin/*` pages — once this
  spec exists, changes to `app/admin/layout.js` or `lib/api.js`
  `adminApi`/`request()` must keep it green.
- Sibling future contracts reuse this setup: A2 (gate negative),
  A3 (reject path) — they will share a helper, not duplicate seeding.

## Migration / deploy / OTA impact
- None. Test + optional QA-config only. `chore(qa)`-class change,
  deploy-inert (not in any app bundle).

## Risk notes
- Deterministic (session seeded, APIs stubbed) — no live backend, no
  real admin account, no DB writes. No destructive aspects.
- Selector risk: the page uses utility classes, few stable testids.
  The spec will target visible text / roles ("Approval Queue",
  "Approve", "approved successfully", "QA Diner"). If brittle, the
  follow-up is to add `data-testid`s to `approvals/page.js` — that
  WOULD be an app-code change and would get its own micro-contract.
