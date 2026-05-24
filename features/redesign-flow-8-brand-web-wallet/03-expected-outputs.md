# 03 · Expected outputs — Flow 8

## Page chrome

- Sits inside dashboard `/layout.js` chrome (left sidebar nav + topbar) — no immersive override
- Outfit display, Plus Jakarta body, JetBrains Mono on every ₹ / IFSC / account number / date
- Locked palette throughout (white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow accents)

## Main column

### Hero wallet card
- Yellow-pale gradient background (`#FFFDEB → #FFF7CC`) + 2 overlapping yellow circle accents (opacity .22 + .14)
- "Wallet" eyebrow (uppercase mono) + 48px mono balance + "available to spend" sub
- Inline yellow "+ Top up" pill button (anchors to top-up section below)
- Live "Last topped up" date when transactions exist

### KPI strip (3 compact tiles)
- Available Balance · Locked in Escrow · Total Deposited
- White tiles, ink heading, mono number, muted sub-label

### Top-up section
- White card with Outfit H3 heading
- Input row: ₹ prefix + number input with yellow focus halo
- 4 quick-pick chips below input (₹5K · ₹10K · ₹25K · ₹50K) — ink hover, yellow active
- Ink primary "Top up" button (full width on mobile, fixed-width on desktop)
- Razorpay theme color: yellow `#FFC107`
- Helper line below: "Funds appear instantly. Razorpay handles UPI / card / netbanking."

### Transaction history
- White card with Outfit H3 heading + total count
- Filter chip row: All · Top-ups · Escrow · Refunds · Fees · Payouts (mono counts)
- List rows: icon + type label + description + date (left) · mono signed amount (right)
- Credit types (topup, escrow_release, refund) render with `+` prefix in success-green
- Debit types (escrow_lock, payout, platform_fee) render with `−` prefix in ink
- Empty state: "No transactions yet" centred message
- Loading state: skeleton placeholder rows (or simple "Loading…")

### Low-balance warning
- Pale-yellow card with ⚠ icon + "Below ₹10K — top up to publish new campaigns" + inline "Top up now →" CTA
- Renders when `wallet_balance < 10000`

## Right rail (sticky on desktop, stacked below on mobile)

### Bank account form
- White card with Outfit H3 + "for follower payment settlements" subhead
- Inputs: Account holder name * · Bank name · Account number * (digits only, mono) · IFSC * (uppercased, mono, max 11) · UPI ID
- Masked display under account number when length > 4
- Ink primary "Save bank details" button (right-aligned)

### "How wallet works" card
- 3-bullet explainer: top-up (instant), escrow lock (at publish), escrow release (at content live + 30d auto)
- Linkable to docs (placeholder for now)

## QA gate

- `pnpm qa` = 67/67 PASSED · STATE=GREEN · gate 0
- No spec re-baseline (no spec asserts on /dashboard/wallet copy/layout)

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) does NOT fire (web only)

## Functional preservation

- All 4 wallet API endpoints preserved (no shape change)
- `brandApi.getMe + updateMe` preserved (bank details merge logic unchanged)
- Razorpay top-up flow preserved (order create → checkout → verify) — ONLY change is theme color
- Bank-details JSON shape preserved (account_holder_name, bank_name, account_number, ifsc_code, upi_id)
- Validation rules preserved (required: holder + account + IFSC)
- Toast pattern preserved
- Auth + role gating from layout.js inherited unchanged
