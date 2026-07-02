# Impact Analysis — Admin Host Split (B-1, Option A)

> Terse verdict: one middleware file; host-based routing. No backend, no DB, no CORS change.
> Safety-reviewed (no loop/lockout/QA-break); QA GREEN.

## Affected files
- Packages/brand-web/middleware.js (only). (Not under app/src/... so gov-check treats it as
  non-governed; still production-impacting web runtime → surfaced for explicit go.)

## Behavior
| Host | Path | Result |
|---|---|---|
| admin.inflx.in | / | → /admin |
| admin.inflx.in | /admin (no cookie) | → /login (served on admin host) |
| admin.inflx.in | /dashboard* | → https://inflx.in/dashboard* |
| inflx.in | /admin* | → https://admin.inflx.in/admin* |
| inflx.in | /dashboard*, everything else | unchanged |
| localhost / *.vercel.app | /admin, /dashboard | unchanged (old cookie gate) |

## Affected workflows (regression surface)
- Admin nav-sweep + role-gate Playwright specs run on localhost → unchanged behavior → still GREEN.
- Brand app on inflx.in: only /admin is redirected; /dashboard and all else untouched.

## Migration / deploy / OTA impact
- Frontend (Vercel) push only. No migration, no OTA, no backend.

## Risk notes
- Prerequisite DONE by founder: admin.inflx.in added in Vercel + DNS (verified resolving + 200).
- Post-deploy verification: confirm admin.inflx.in/admin serves admin, inflx.in/admin 307→admin host,
  inflx.in/dashboard still works, admin login works on admin.inflx.in.
- Follow-ups: real edge JWT gate; Option C full extract if desired.
