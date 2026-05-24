# 03 · Expected outputs — Flow 9

## Page chrome

- Inside dashboard `/layout.js` chrome (no immersive override)
- Outfit display, Plus Jakarta body, JetBrains Mono on every ₹ / @handle / date / followers-count
- Locked palette throughout (white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow accents)
- Single column max-w-5xl (inbox surface — no rail)

## Header
- Crumb: `/dashboard · contracts`
- Outfit H1 "Contracts" + yellow rule + mono count chip (e.g. "12 pending") + ghost Refresh button (right)
- Subtitle: "Influencers have signed. Counter-sign to lock funds + start the campaign."

## Wallet status strip (NEW, always visible)

Compact ink card (collapsed-height):
- "Wallet" label · mono ₹balance
- "Selected lock" label · mono ₹running-total (₹0 when nothing selected)
- Progress bar showing locked / wallet ratio
- "Short by ₹X" red chip when running-total > balance
- "Top up wallet" tiny CTA → links to `/dashboard/wallet`

## Sticky bulk action bar

- Select-all checkbox (yellow accent) + count
- Right side: ink "Sign selected (N)" button with yellow text (disabled when N=0 OR walletShort)
- Border thickens / shadow appears when at least one row selected (visual affordance)

## Contract row cards

Per row (white card, yellow-50 selected state):
- Checkbox (yellow accent)
- @handle (mono, bold) + tier-derived chip (Nano/Micro/Macro/Mega based on followers_count) + verified chip if applicable
- Sub: campaign-name · signed-date (mono) · production-mode chip (visit/shipment/remote)
- **Format chips** (NEW from `formats_json`) — small chips like `1 reel · 2 stories`
- **Followers count** (NEW from `followers_count`) — mono number with "followers" suffix
- Right side: "Lock" mono label + bold mono ₹amount + (when bonus > 0) `₹base + ₹bonus` breakdown
- Review → link to `/dashboard/campaigns/{campaign_id}`

## Empty state

- Yellow-pale card with friendly icon + "No contracts waiting on you"
- Sub: "When an influencer signs, it'll show up here for your countersignature."
- Link to `/dashboard/campaigns` ("See all your campaigns")

## Loading / error / success states

- Loading: shimmer rows OR plain "Loading contracts…" centred
- Error: danger-pale card with backend message + Refresh CTA
- Success: success-pale toast bottom-right (auto-dismiss 3s)

## QA gate

- `pnpm qa` — wallet-isolated workflows GREEN; pre-existing 3 backend-defect failures in `qa/api/*` (Window A auth/verify-otp regression) carry forward as the same carve-out (`features/backend-defect-auth-verify-otp-role-validation/`). No new failures introduced.

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) — same pattern as Flow 8: `released=false` + `release_state=deployed-pending-certification` until Window A backend-defect closes
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) does NOT fire — web only

## Functional preservation

- All 3 endpoints + every request body shape preserved
- Bulk-sign confirm + per-contract validation preserved
- Wallet-short gating preserved
- Review link target unchanged (`/dashboard/campaigns/[id]`)
- Empty / loading / error pathways preserved
- Toast pattern preserved
- Brand-approval gate inherited from layout.js
