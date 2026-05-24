# Impact — Flow 9

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX restyle only, plus surfacing 2 backend fields already loaded but unused (`formats_json`, `followers_count`).**

Same 3 endpoints, same selection logic, same bulk-sign confirm flow, same wallet-short gating. Wave1 palette swapped for locked wave2. Wallet status strip becomes always-visible (vs only-when-selected).

## Files touched (1 web)

- `Packages/brand-web/app/dashboard/contracts/page.js` — rewrite (~194 → ~340 LOC estimated; growth from CSS block + wallet strip + format-chips render + tier-derivation helper)

## Files NOT touched

- `backend/**` (both new-use fields already in the SELECT)
- `Packages/brand-web/lib/api.js` (all calls reused)
- Mobile · admin web · all other web pages

## NO-TOUCH (preserved exactly)

- `contractApi.{listPending, bulkSign}` + `walletApi.getBalance` (3 endpoints)
- Selection set + toggle + toggleAll semantics
- Bulk-sign confirm dialog message format (count + lock total)
- Wallet-short button gating (client mirror of server enforcement)
- Page-load parallel fetch order
- Review link target (`/dashboard/campaigns/{campaign_id}`)
- Brand-approval gate from layout.js
- Toast pattern + error banner pattern

## Window A coordination

NONE for this flow's code. The backend-defect carve-out from Flow 8
(`features/backend-defect-auth-verify-otp-role-validation/`) remains
open — same 3 auth-test failures will persist in `pnpm qa` until
Window A resolves their `3920772` regression.

## Regression risk

LOW. `pnpm qa` 67/71 must hold (same partial-green as Flow 8 — no
fake-green). No Playwright spec asserts on `/dashboard/contracts`
copy/layout.

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys brand-web
- NO mobile, NO OTA
- Rule 5 does not fire
- Rule 2 gate: same pattern as Flow 8 — `released=false` with
  `release_state="deployed-pending-certification"` until Window A
  closes the backend-defect carve-out

## Time estimate

~1-2h focused work. Smallest flow yet by LOC; clean code, no bugs to fix.
