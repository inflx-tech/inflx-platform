# Impact Analysis — Commerce Settlement Hold + Ledger (G-3 + G-5)

> Terse verdict: money-core change — defers brand payout, adds per-item claw-back + influencer
> ledger. Additive migration. Reviewed by two adversarial money reviewers; QA GREEN. Backend-only.

## Affected files
- backend services: settlement.service.js (net-of-returns), transaction.service.js (ledger+RETURNING),
  escrow.service.js, withdrawal.service.js, referral.service.js, ledger.service.js (NEW).
- backend jobs: commerce-settlement.job.js (NEW), commission-confirm.job.js (net + open-return),
  jobs/index.js (register).
- backend controllers: transaction.controller.js (removed 5 sale-time settle calls),
  returns.controller.js (clawbackOnRefund), webhook/admin/enquiry (ledger), influencer.controller.js (getLedger).
- backend routes: influencer.routes.js (GET /influencers/me/ledger).
- migration 112_commerce_settlement_hold_and_ledger.sql (NEW).
- mobile/web: NONE (UI is follow-up). So NOT UI-governed.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /influencers/me/ledger | NEW (paginated, self-scoped) | influencer app (follow-up UI) |
| (cron) | commerce-settlement.job | NEW post-window brand settle | system |
| internal | settleCommerceTransaction | now net-of-returns; called from job not sale | system |

## Affected workflows (regression surface)
- Purchase verify (5 flows), commission-confirm cron, returns refund, escrow tranche, withdrawals,
  enquiry, referral accrual — all reran under pnpm qa (GREEN). settlement-retry job unaffected.

## Migration / deploy / OTA impact
- Migration 112 (additive + legacy backfill to 'settled') MUST be applied to prod before/with code.
- Backend-only → push (Render). No web, no OTA.

## Risk notes (read before deploy)
- **C1 (CRITICAL but DORMANT — HARD GATE before Razorpay Route goes live):** settleCommerceTransaction
  fires the Route transfer, THEN writes the idempotency marker (tcs_amount) in a separate statement.
  A crash between the transfer and that write would let the nightly job re-transfer = brand double-paid.
  This is a PRE-EXISTING weakness in the settlement service (not introduced here; the old inline call had
  the same gap). Today **RAZORPAY_MOCK=true in prod** → no real transfers → dormant. **REQUIRED FIX before
  RAZORPAY_MOCK is set false / Route launches:** pass a deterministic idempotency key to Razorpay (keyed on
  transaction_id) OR pre-check existing transfers for the payment OR claim-row-before-transfer. Do NOT
  enable real Route payouts until this is closed.
- Reviewer-fixed in this change: MEDIUM-1 (whole-order detection keyed on brand_net remainder, not commission
  — prevents under-paying the brand on uneven partial returns); LOW-3 (total_earned now reduced on
  confirmed-then-returned commission).
- Accepted/noted: LOW-1 (duplicate same-product lines without variant_id match first line — bounded by cap);
  LOW-2 (ledger append on pool-level sites not in the money txn — best-effort audit, no balance drift);
  GST on partial returns computed on full marketplace fee (slight overstatement) — revisit with finance.
- No real money moves today (mock). Logic verified by two adversarial reviewers + QA GREEN.
