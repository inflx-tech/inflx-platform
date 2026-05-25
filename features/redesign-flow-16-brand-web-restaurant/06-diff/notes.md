# Flow 16 · diff notes — what shipped

## Shipped vs mockup

5 mockup states implemented across 4 page rewrites (meals + orders + bookings/BookingsInbox + enquiries).

### Enquiries · `enquiries/page.js` (87 → 252 LOC)
- Flow 11 Conversions Enquiries pattern: status filter chips with mono counts · row cards with 💬 Enquiry badge · inline expand replacing modal · canonical status values (drops dead new/contacted)
- markConverted preserves prompt() flow
- Sub: "See also /conversions for combined view"

### Orders · `orders/page.js` (221 → 323 LOC)
- Flow 11 Conversions Orders pattern: INK 3-KPI hero + 3 channel chip cards + 5-chip status filter + row cards with inline expand
- Pagination preserved
- Sub: "See also /conversions for combined view"

### Bookings · `bookings/components/BookingsInbox.js` (317 → 354 LOC)
- 4 mono stat tiles (Pending attn yellow / Today / Upcoming / Revenue 7d green)
- INK 5-tab pills with Pending count badge
- Date-badge booking cards (66px square: Outfit day + JBM month + time)
- Status pill palette mapping (pending/confirmed/rejected/cancelled/unreviewed)
- Confirm (ink+yellow) / Reject (danger outline) inline for pending
- Confirmed/cancelled tag for non-pending
- Creator attribution success-pale pill OR direct-booking text
- REF code mono · customer notes italic · brand review note yellow-pale
- `bookings/page.js` thin wrapper preserved (14 LOC, unchanged)

### Meals · `meals/page.js` (484 → 617 LOC)
- INK 2-tab pills (Offers & setup / Today's orders)
- **Setup tab**: yellow-pale AI suggestions card + ink Generate button · party-size chips with palette mapping + mono counts · suggested + active offer cards (palette tints) · create-by-chat box (yellow-dashed border + ink chat thread + ink Build CTA) · sidebar DiscountClock editor + Limits card
- **Today tab**: 4 mono stat tiles (Capacity Left auto-attn when <30%) · INK progress card with yellow→hover gradient fill · incoming orders table with palette status pills + Mark delivered action · sidebar Kitchen prep mono counts + Unmatched requests
- All 8 mealsApi endpoints + restaurant-chat AI flow preserved verbatim

## QA failure encountered + fix (honest)

**1st run**: 74/75 passed, 1 genuine code failure in `meals-setup.spec.ts`:
```
Locator: getByText('Family Mixed Pack', { exact: true })
Expected: visible
```

**Root cause**: I put the offer status pill INSIDE the offer-name div, making the text content "Family Mixed Packactive" instead of exactly "Family Mixed Pack". OLD code had name and status in separate divs.

**Fix** (1-line edit): moved status pill into the `offer-kind` div (sibling of `offer-name`):
```jsx
// before
<div className="offer-name">{rule.name}<span>{rule.status}</span></div>

// after
<div className="offer-name">{rule.name}</div>
<div className="offer-kind"><span className="status">{rule.status}</span><span>{kind}</span></div>
```

**Classification**: This was **genuine code regression** (assertion drift — my CSS reorganization broke the existing test's exact-match assertion). Caught and fixed before deploy. Per `feedback_qa_governance.md` — tests caught a real issue.

**2nd run after fix**: 75/75 passed · gate 0 · STATE=GREEN · 45s · first-run clean (post-fix).

## CSS scoping discipline — verified

All rules scoped under per-route wrappers (`.ml` / `.ord` / `.bk` / `.enq`). Spot-check:

**Meals (`.ml`):**
- `.ml .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.ml .offer-actions .accept:hover:not(:disabled){background:#0E9F6E;border-color:#0E9F6E;color:var(--white)}` — color re-asserted ✓
- `.ml .offer-actions .reject:hover:not(:disabled){background:var(--danger-pale);border-color:var(--danger);color:var(--danger-text)}` — color re-asserted ✓
- `.ml .save-clock:hover{background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.ml .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}` — active hover preserved ✓
- `.ml .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓

**Bookings (`.bk`):**
- `.bk .bc-actions .confirm:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.bk .bc-actions .reject:hover:not(:disabled){background:var(--danger);border-color:var(--danger);color:var(--white)}` — color re-asserted ✓
- `.bk .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}` — active hover preserved ✓

**Orders (`.ord`):** same patterns as Flow 11 Conversions ✓
**Enquiries (`.enq`):** same patterns as Flow 11 Conversions ✓

## Honest notes

1. **/orders + /enquiries duplicate Conversions** (Flow 11) — preserved per behavior-frozen rule. Both pages now have a sub-line noting "See also /conversions for a combined view." Future cleanup flow can deprecate or pivot to deep-link variants.

2. **Meals offer card**: NEW status placement (inside `.offer-kind` sibling of `.offer-name`) is cleaner than OLD's status-in-secondary-line approach. Status is more prominent + spec test compatibility preserved.

3. **Bookings `bookings/page.js`** (14 LOC thin wrapper) — preserved verbatim. Only BookingsInbox.js component was rewritten.

4. **Meals defaults preserved**: party defaults to `'family'`, config falls back to defaultConfig() when missing, all helper functions (computeDisplayPrice, defaultConfig) preserved.

## QA evidence

- **1st run**: 74/75 (1 genuine code failure on `meals-setup.spec.ts` — exact-text assertion). Fixed in-flight via 1-line CSS reorganization.
- **2nd run (post-fix)**: **75/75 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN** (45s)
- Report: `qa/reports/2026-05-25T06-47-20-592Z/QA-REPORT.md`
- First-run clean (post-fix): YES
- Stale-server cleanup applied (Flow 12 lesson) on both runs

## LOC

- OLD: meals 484 + orders 221 + bookings/page.js 14 + BookingsInbox 317 + enquiries 87 = **1,123**
- NEW: meals 617 + orders 323 + bookings/page.js 14 (unchanged) + BookingsInbox 354 + enquiries 252 = **1,560**
- Net: +437 LOC (mostly scoped CSS blocks)
- Mockup: 935 LOC

## Adjacent-fixes shipped
- /enquiries: dead `new`/`contacted` status colors → canonical (matches Flow 11)
- /bookings: custom Tailwind tokens (paper-surface, yellow-pale, ink-1/2/3) → palette CSS vars
- /meals: navy-deep / pink-700 / orange Tailwind → palette
- /orders: teal/blue/purple/green tints → palette
- All routes: loading skeletons → locked-palette spinner
