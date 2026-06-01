# Expected Outputs — referral-agency-role (Contract 3a)

> Defined BEFORE coding. jest asserts against these. "Compiles" is not output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| A1 | `verify-otp role='agency'` → `users` row role=agency, status=pending | jest: verify-otp, query users |
| A2 | `POST /agencies/register` → 201, `agencies` row (wallet 0), user pending | jest: register, query agencies |
| A3 | `GET /agencies/me` → profile + wallet + non-empty `code` | jest: GET, assert code present + stable on 2nd call |
| A4 | `PATCH /admin/agencies/:id/status approved` → users.status=approved, approved_at set | jest: approve, re-GET status |
| B5 | `POST /referrals/redeem {code}` (as brand) → 201, active edge referrer=agency, referred=brand, pct=default, source='signup' | jest: redeem, query referral_edges |
| B6 | redeem when caller already has active edge → 409/422, edge count unchanged | jest: seed edge, redeem → error |
| B7 | redeem unknown code → 404; self/circular → 422 | jest: bad redeems |
| C8 | agency-referred confirmed revenue → ledger row `paid`, `agencies.wallet_balance` += amount, `referral_earned_total` += amount | jest: create agency edge, accrue subscription, assert wallet + paid |
| C9 | influencer-referred accrual unchanged (still credits influencer) — no cross-talk | jest: influencer edge still paid to influencer wallet |
| D10 | `POST /agencies/me/withdraw 1000` → `agency_withdrawals` row tds_deducted=50.00 (5%), net_paid=950.00, wallet -=1000 | jest: approved agency w/ balance, withdraw, assert math |
| D11 | `GET /agencies/me/withdrawals` → the row | jest: list |
| D12 | withdraw > balance / below min / not approved → 422/403, wallet unchanged | jest: negative cases |

## Data assertions (post-workflow)
- `user_role` enum now includes `agency`; `agencies` + `agency_withdrawals`
  tables exist; `payment_config.agency_tds_pct = 5.00`.
- **Settlement invariant:** for an agency accrual, `referral_ledger.amount` is
  unchanged from C1's math (`round2(base × pct/100)`); the ONLY new effect is
  `agencies.wallet_balance`/`referral_earned_total` += amount and
  `payout_status='paid'`. Influencer net / brand net / escrow / subscription
  amounts are byte-for-byte identical to a pre-3a baseline.
- **TDS correctness:** agency `tds_deducted = round2(amount × agency_tds_pct/100)`
  = 5% by default; influencer withdrawals STILL deduct 10% (no regression);
  brand withdrawals STILL deduct 0.
- `agencies.wallet_balance` never goes negative (withdrawal guarded).
- Code redeem routes through `referral.service.createEdge` (guards + dedup
  index intact); ≤1 active edge per referred entity holds.

## Visual evidence required
- None (backend-only; UI-governed gates N/A — the mobile surface is 3b).
  Evidence = `pnpm qa` GREEN + the new `referral-agency.test.js` jest suite
  green + existing money/withdrawal/engine suites green with unchanged figures.
