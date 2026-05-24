# Impact — Flow 8

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX restyle only + 1-line adjacent-fix to a stale low-balance threshold.**

Same 4 wallet endpoints, same Razorpay flow, same bank-details shape, same validation. Wave1 palette swapped for locked wave2. 2-column layout (main + bank rail) replaces single narrow column. One 1-line bug fix to a paise-era threshold that survived migration 021.

## Files touched (1 web)

- `Packages/brand-web/app/dashboard/wallet/page.js` — rewrite (~348 → ~420 LOC estimated; small growth from extracted card/chip helpers + bank rail extraction)

## Files NOT touched

- `backend/**` (all 4 endpoints used as-is)
- `Packages/brand-web/lib/api.js` (all calls reused)
- Mobile (no wallet mirror today on web — separate flow when we hit mobile)
- All other web pages

## NO-TOUCH (preserved exactly)

- `walletApi.{getBalance, createTopup, verifyTopup, getTransactions}` (4 methods)
- `brandApi.{getMe, updateMe}` (bank-details merge path)
- Razorpay checkout config (only `theme.color` changes from `#F47920` → `#FFC107`)
- Pendingorders → verify signature flow (server-side, no client touch)
- Bank-details JSON shape: `{ account_holder_name, bank_name, account_number, ifsc_code, upi_id }` (every property name preserved)
- Validation: account_holder_name + account_number + ifsc_code required (no rule change)
- Account-number sanitiser (strips non-digits) + IFSC uppercase
- Account-number masking helper (display only)
- Toast pattern
- All 4 quick-pick amounts (₹5K · ₹10K · ₹25K · ₹50K)
- Brand-approval gate from layout.js

## Adjacent-fix (declared)

Per `feedback_adjacent_fix.md` rule: when already in a file, fix small in-scope bugs silently. The low-balance threshold at OLD line 195 is a stale paise-era constant that survived migration 021. Fix:

```diff
-      {/* Low balance warning — balance is in paise; 10000 paise = ₹100 */}
-      {balance < 1000000 && (
+      {/* Low balance warning — practical floor to publish a small campaign */}
+      {balance < 10000 && (
```

Surfaced to founder before code; included in 06-diff/notes.md.

## Window A coordination

NONE. Window A doesn't touch this surface.

## Regression risk

LOW. `pnpm qa` 67/67 must hold. No Playwright spec asserts on /dashboard/wallet copy/layout. Razorpay flow is end-to-end test in mock mode; theme color change is cosmetic and cannot affect signature verification.

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys brand-web
- NO mobile, NO OTA
- Rule 5 does not fire

## Time estimate

~2-3h focused work. Single file, small scope, 1 bug fix.
