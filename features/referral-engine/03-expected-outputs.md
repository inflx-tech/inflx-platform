# Expected Outputs — referral-engine (Contract 1)

> Defined BEFORE coding. QA asserts against these. "Compiles" is not output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| A1 | 1 `referral_ledger` row `source='subscription'`, `base_amount`=invoice.amount_inr, `amount`=round2(base×pct/100) | jest+DB: charge a seeded sub, query ledger |
| A2 | replay webhook → still exactly 1 row | jest: call handler twice, count rows = 1 |
| B3 | 1 ledger row `source='protection_fee'`, base=escrow_fee_amount | jest+DB: release a tranche, query ledger |
| B4 | 3 ledger rows across T1/T2/T3, one per escrow_entries.id; `net_to_influencer` unchanged | jest: release all 3, count=3, assert influencer net |
| C5 | 1 ledger row `source='commission'`, base=marketplace_fee_amount; referrer influencer `wallet_balance` += amount, `referral_earned_total` += amount, row `payout_status='paid'` | jest+DB: run commission-confirm job on a seeded confirmable txn |
| C6 | referred influencer's own pending→wallet credit = full unchanged amount | jest: assert influencer wallet delta = platform commission, not reduced |
| D7 | expired edge → 0 ledger rows | jest: seed edge expires_at=past, fire event, count=0 |
| D8 | no edge → 0 ledger rows | jest: fire event for unreferred entity, count=0 |
| D9 | second active edge insert rejected | jest: expect unique-violation on dup active edge |
| D10 | self/circular edge create rejected | jest: expect VALIDATION_ERROR from referral.service |

## Data assertions (post-workflow)
- `referral_ledger.amount` = `round2(base_amount × pct / 100)` exactly, rupees.
- `unique(source, source_ref_id)` holds — no duplicate accrual under retry.
- `uniq_referral_active_referred` holds — ≤1 active edge per referred entity.
- **Invariant (the correctness guarantee):** for every accrual, the
  platform-side base figure it derives from (`marketplace_fee_amount`,
  `escrow_fee_amount`, `subscription amount_inr`) and every counterparty credit
  (`influencer_commission` / `pending`→`wallet`, escrow `net_to_influencer`,
  `brand_net`) are **identical to a pre-feature baseline run** — referral money
  comes only out of the platform's slice.
- Influencer-referrer: `Δwallet_balance == Σ amount` of their `paid` commission
  ledger rows; `referral_earned_total` matches.
- Agency-referrer (synthetic seed): ledger rows present, all `payout_status
  ='pending'`, no wallet table touched (agency wallet not yet built).

## Visual evidence required
- None (backend-only contract; UI-governed gates N/A). Evidence = `pnpm qa`
  report showing the new referral-engine spec GREEN + existing money specs
  (escrow, commission-confirm, subscription webhook, pay-at-store) still GREEN
  with unchanged base figures.
