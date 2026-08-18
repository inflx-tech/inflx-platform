# Impact Analysis — Remove dev-mode OTP hints

## Affected files (read or change)
- `Packages/Mobile/src/screens/auth/OTPScreen.js` — 1 JSX line + 1 style line
- `Packages/Mobile/src/screens/auth/PhoneScreen.js` — 1 JSX line + 1 style line
- `Packages/brand-web/app/login/page.js` — 3 JSX lines (one `<span>` block)
- `Packages/admin-web/app/login/page.js` — 1 JSX line
- Backend: none. Migrations: none. Shared/lib: none.

Total: 8 deletions, 0 insertions, 4 files.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| — | — | none | — |

## Affected workflows (regression surface)
- Sign-in on all surfaces. The deleted nodes are presentational only and were
  not referenced by any handler, effect, test or selector.
- `MONO` (OTPScreen) and `Platform` (PhoneScreen) remain used elsewhere in
  their files after the style deletion — verified, no dead imports created.

## Migration / deploy / OTA impact
- Migration: none.
- Web: `Packages/brand-web` + `Packages/admin-web` → **Vercel redeploy on push.
  PRODUCTION-IMPACTING.**
- Mobile: `Packages/Mobile/src/**` JS changed → **OTA publish required** for
  the change to reach installed apps. No native change, so no APK rebuild.
- Backend: untouched — Render redeploys as a no-op.

## Risk notes
- Lowest-risk class of change: deletion of static presentational nodes.
- Reversible: `git revert` restores the pills; no data or state involved.
- The one thing worth eyeballing is centering, since three flex rows lose a
  child. Captured in 06-diff.
- Not a rollback risk but worth stating: after this ships, a developer running
  a local build against a `OTP_MOCK=true` backend gets no on-screen reminder
  that `000000` works. That is the intended trade — the hint was leaking a
  backdoor-shaped message to production users.
