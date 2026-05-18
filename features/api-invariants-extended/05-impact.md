# Impact Analysis — Extended API invariants (B1b)

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/api/invariants-extended.spec.ts`
- **Read, not changed:** backend `/admin/*` route guards,
  `auth.controller.js` (verify-otp role check — confirmed: new user
  + no role → 422 VALIDATION_ERROR field 'role'), `/auth/refresh`,
  the 404 handler.
- No application code. No migration, mobile, OTA. **Deploy-inert.**
- Config: none (testMatch already covers `api/**/*.spec.ts`).

## Affected routes / APIs (error/authz/contract paths only)
| Method | Path | Why | Mutates? |
|---|---|---|---|
| GET | /admin/stats, /admin/queue/influencers, /admin/brands | W4 unauth | no |
| PATCH | /admin/brands/qa-nonexistent/status | W4 unauth on a mutation | no (rejected at auth) |
| POST | /auth/send-otp, /auth/verify-otp | W5a/W5b contract | otp_codes row only |
| POST | /auth/refresh | W5c no-cookie | no |
| GET | /unknown-route | W6 404 envelope | no |

## Affected workflows (regression surface)
- Widens B1's API-layer security/contract net. Complements L2 A2
  (web gate) and L3 mobile attribution — same invariants, deeper
  coverage at the API.

## Migration / deploy / OTA impact
- None. `test(qa)`-class, deploy-inert.

## Risk notes
- Live-backend cold start: warm/retry like B1; transient failure
  reported honestly, not retried infinitely.
- W4 PATCH on a nonexistent id is safe — auth rejection precedes
  resource lookup; nothing is mutated even in the (failing) case
  where auth were bypassed (it returns 4xx either way).
- W5c exact code (likely 401) observed + pinned at Step 7 — the
  invariant (clean 4xx, not 5xx) is what's contracted.
- W6: if the backend returns an HTML/Express-default 404 that is a
  real envelope-consistency finding — reported, not suppressed.
