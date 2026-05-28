# 02-workflow — wave3-settlement-retry-cron

## Hourly run (:20)
1. SELECT eligible: `follower_transactions` where status='completed',
   `razorpay_transfer_id IS NULL`, `tcs_amount IS NOT NULL` (already settled),
   `brand_net > 0`, and the brand has `razorpay_linked_account_id` (LIMIT 200,
   oldest first).
2. For each → `settlement.service.retryTransfer`:
   - skip if already transferred / no linked account / zero amount;
   - else Route-transfer `brand_net − tcs_amount` → set `razorpay_transfer_id`.
   - a Route failure throws → the job catches + counts it (retried next hour).
3. Returns `{ retried, succeeded, failed }`.

## Primary use case
A brand makes commerce sales, THEN onboards a payout account (W3.1). The earlier
sales were settled (taxes recorded) but their transfers were skipped (no account
then). This cron picks them up on the next run and transfers the brand's net.

## Test mode
`ENABLE_CRONS=false` in tests — the job is loaded but not scheduled; tests call
`settlementRetryJob.run()` directly. Mock Route returns synthetic transfer ids.
