# Flow 34 — Expected outputs

## Per-screen rendered output assertions

### EarningsScreen

| State | Expected render |
|---|---|
| Loading | Empty body (sections render with placeholders as data arrives) |
| Loaded — has wallet balance | Yellow-mono "₹XX,XXX" amount in ink hero |
| Loaded — no campaign earnings | "No campaign earnings yet" empty card |
| Loaded — has campaigns | Per-campaign cards with success+yellow progress bar |
| amount entered | Yellow-pale TDS preview card with 3 rows + danger TDS line + success You-Receive |
| amount < 100 OR empty | Withdraw CTA disabled |
| Withdrawing | "Processing…" disabled CTA |
| TDS cert tap | `Linking.openURL(getTdsCertificateUrl())` |
| Has withdrawals | History list with StatusPill canonical |

### CommissionDetailScreen

| State | Expected render |
|---|---|
| Loading | Yellow ActivityIndicator centered |
| Error | Error text + Retry button |
| Loaded | Ink hero w/ 3-stat row + info row + tranche timeline + commission section + optional 30-day info banner |
| Goal=engagement | Commission section hidden unless commissions > 0 |
| Goal ∈ {conversion, hybrid} | Commission section visible with summary cards + per-tx rows |
| Commissions > 5 | "Show all N commissions" toggle visible until tapped |
| Any pending commission | 30-day info banner rendered |

### TransactionFeedScreen

| State | Expected render |
|---|---|
| Loading | Yellow ActivityIndicator centered |
| Empty | 📊 emoji + "No transactions yet" |
| Loaded — has summary | 3-card summary row + FlatList |
| tx with booking_ref | Extra row with mono "REF:" |

## Data assertions

- TDS preview: `tds = amount * 0.1`, `net = amount - tds`, displayed via `fmtMoney`
- Min ₹100 enforced client-side with Alert
- Commission % in section title: `(${data.commission_pct}%)` if present
- "30-day-window" info banner conditional on `commissions.some(c => c.status === 'pending')`
- `getCampaignCommissionDetail` returns `{ campaign_name, brand_name, goal, ci_status, agreed_fee, commission_pct, tranches[], commissions[], summary{total_earned, total_pending, commission_confirmed, commission_pending} }`
- `getMyTransactions(1)` returns `{ transactions[], summary{total_commission, total_transactions, today_commission} }`

## Visual evidence

Side-by-side comparison via `pnpm diff:open redesign-flow-34-influencer-mobile-earnings-commission-transactions`:
- `before` = `04-preview/mockups/web.html` rendered at 375×760 (5 frames)
- `after` = founder physical smoke-test on installed APK
- `notes.md` documents per-screen palette/font/branch-preservation evidence

## Backend assertions (no new endpoints)

All 7 APIs preserved verbatim (see 02-workflow.md).
