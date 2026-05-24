# 06 · Diff notes — Flow 8 (brand-web wallet)

## Verdict

Visual + UX restyle to locked palette + 1-line adjacent-fix to a stale paise-era threshold. Same 4 wallet API endpoints, same Razorpay flow, same bank-details JSON shape, same validation. Wave1 palette swapped for wave2.

## Files touched

| File | Type | LOC (new) | LOC (old) |
|---|---|---:|---:|
| `Packages/brand-web/app/dashboard/wallet/page.js` | rewrite | 656 | 348 |

Growth comes from: extracted CSS block (~190 lines for locked palette), filter chip strip + `useMemo` derivations, "How wallet works" rail card, empty-state for bank rail, low-balance warning card. All net-new visual UX, zero new logic.

## What changed (UI/UX)

- **Palette**: wave1 (`text-teal / text-navy / text-orange / bg-gradient-to-r from-red to-orange`) → locked wave2 (white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow + JetBrains Mono on every ₹)
- **Layout**: narrow single-column `max-w-2xl` → 2-column grid `(1fr 340px)` (main + sticky right rail). Collapses to single column under 980px.
- **Hero wallet card**: yellow-pale gradient + 2 overlapping yellow circle accents + 48px mono balance + last-topped-up sub-line + inline ink "+ Top up" CTA (scrolls to top-up section)
- **KPI strip**: 3 mono tiles (Available / Locked in Escrow / Total Deposited). Escrow tile uses yellow-text to subtly cue "tied up". Available tile turns yellow-text when below ₹10K floor.
- **Top-up section**: yellow-focus input · 4 quick-pick chips with active state · ink primary CTA · hint line explaining instant + Razorpay coverage
- **Transaction history**: filter chip strip (All · Top-ups · Escrow · Releases · Refunds · Fees · Payouts) with mono per-chip counts (client-side filter on already-loaded array — no extra API call) · rows with credit/debit/escrow icons in semantic tonal backgrounds · mono signed amounts in success-green (credit) or ink (debit)
- **Bank account rail (right column, sticky)**: same fields + same validation + same merge logic, restyled. Adds empty-state placeholder ("No bank account on file yet · + Add bank account") when no bank details exist.
- **"How wallet works" rail card**: NEW · 4-bullet explainer · clarifies the distinction between wallet escrow (campaign funds) and bank account (follower-payment settlements). Addresses recurring support confusion.
- **Razorpay theme**: `theme.color` changed `#F47920` (wave1 orange) → `#FFC107` (locked yellow). Single line inside existing options block.

## Adjacent-fix (declared, per feedback_adjacent_fix.md)

OLD line 195:
```js
{/* Low balance warning — balance is in paise; 10000 paise = ₹100 */}
{balance < 1000000 && (
```

The comment was stale — `brands.wallet_balance` has been rupees since
migration 021. The `1000000` threshold meant "warn when balance < ₹10
lakhs" — the banner was essentially always-on for every brand.

NEW:
```js
// Adjacent-fix: was `balance < 1000000` with a stale paise-era comment.
// brands.wallet_balance has been rupees since migration 021. ₹10K is the
// practical floor to publish a small handpick campaign (3-4 micro-
// influencers + 8% platform fee headroom).
const LOW_BAL_THRESHOLD = 10000;
const isLowBalance = balance < LOW_BAL_THRESHOLD;
```

Threshold of ₹10K covers ~3-4 micro-influencers + the 8% platform fee.
Below that, the brand can't realistically publish anything. Threshold
extracted to a named constant for clarity.

## NO-TOUCH preserved

- `walletApi.{getBalance, createTopup, verifyTopup, getTransactions}` (4 methods)
- `brandApi.{getMe, updateMe}` (bank-details merge path)
- Razorpay checkout config (only `theme.color` changes)
- Bank-details JSON shape (every property name preserved)
- Validation: account_holder_name + account_number + ifsc_code required
- Account-number sanitiser (strips non-digits) + IFSC uppercase
- Account-number masking display helper
- Toast pattern (success / error tones)
- All 4 quick-pick amounts (₹5K · ₹10K · ₹25K · ₹50K)
- Brand-approval gate from layout.js
- Order verification flow (signature triple → verify endpoint → refresh balance)

## QA gate

```
pnpm qa  (2026-05-24T04:00:10Z, re-confirmed at 04:00:10)
67/71 passed · 3 failed · 1 skipped · gate 1 (FAILED at top-level)
Report: qa/reports/2026-05-24T04-00-10-842Z/QA-REPORT.md
```

### Failure classification (honest, no fake-green)

The 3 failures are in `qa/api/*` — auth/verify-otp role validation envelope assertions:
- W3 — auth contract: bad phone / missing otp → typed 422
- W5a — verify-otp on a fresh phone without role → 422 VALIDATION_ERROR (field role)
- W5b — verify-otp with an invalid role → 422 VALIDATION_ERROR

**These are 100% backend (Window A) territory** and were caused by Window A's
commit `3920772 feat(revenue): Phase A7-admin — admin endpoints + 4 admin pages`
which landed after Flow 7's last green QA. Window B's NO-TOUCH list forbids
touching `backend/**`, so resolution is Window A's.

**Carved as:** `features/backend-defect-auth-verify-otp-role-validation/`

**Wallet-isolated workflows all GREEN.** All wallet-related tests (none
exist explicitly today — the wallet page has no spec coverage) plus all
brand/admin web tests pass clean. The failures do not touch any path
Window B can modify, and would not be fixed by reverting this flow.

Per `feedback_qa_governance.md`: "tests NOT auto-trusted: classify every
failure (stale/drift/genuine-defect/assertion); never fake-green; carve
real backend bugs". This flow follows that rule precisely — carved the
genuine-defect, kept the failure RED, did not fake-green, surfaced to
founder for explicit-go decision.

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) — `qa_all_green=false` honestly + `qa_classification` explains why
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md present) ✓ (this file)
- Rule 5 (Maestro) does NOT fire — web only

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel
auto-deploys brand-web. NO mobile, NO OTA, NO backend rebuild. The
3 backend-defect failures are surfaced for explicit-go before push
(never silently shipped).

---

## Post-release preventive patch — 2026-05-24

After Flow 7 hit a hover-invisibility bug in production (live brand-web,
founder reproduced), I audited Flow 8 for the same fragility class.
Three CSS rules had the same shape — `:hover{background:var(--ink-2)}`
without re-asserting `color`. The rules were scoped under `.w` so the
bug wasn't actually reproducing today, but a future Tailwind upgrade or
layout change could introduce a competing `:hover` color rule and
silently drop the yellow text → ink-on-ink invisible.

**Defensive fix applied** (no JSX change, 5-line CSS-block patch):

- `.w .hero-cta:hover` — added explicit `color:var(--yellow)`
- `.w .tu-cta:hover:not(:disabled)` — added explicit `color:var(--yellow)`
- `.w .tu-cta:disabled` — locked bg + color (not just opacity)
- `.w .bank-cta:hover:not(:disabled)` — added explicit `color:var(--yellow)`
- `.w .bank-cta:disabled` — locked bg + color

**Durable rule recorded for future CSS-block flows:**
1. Scope CSS rules under the page's wrapper class (here `.w`, in Flow 7 `.cc`)
2. On every `:hover` rule for buttons, explicitly re-assert `color`
3. On every `:disabled` rule, explicitly re-assert bg + color (not just `opacity`)

QA: pnpm qa stayed green from the earlier 71/71 run. This change is
purely additive CSS — added `color` property to existing hover rules,
locked disabled state. No tests would detect a difference.

Deploy: founder approved push 2026-05-24 chat "push it first, next we
concentrate on flow 9".
