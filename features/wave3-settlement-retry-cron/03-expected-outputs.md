# 03-expected-outputs — wave3-settlement-retry-cron

## settlementRetryJob.run()
Returns `{ retried, succeeded, failed }`.
- Eligible txns (settled, no transfer, brand has linked account) are transferred.
- No eligible rows → `{ retried: 0, succeeded: 0, failed: 0 }`.

## settlement.service.retryTransfer(runner, txnId)
- Success → `{ transfer_id: 'trf_…', transfer_amount }` + row's
  `razorpay_transfer_id` set.
- `{ skipped: 'already_transferred' | 'no_linked_account' | 'zero_amount' | 'not_found' }`.

## Worked scenario (test)
1. Sale settled with no linked account → `tcs_amount` set, `razorpay_transfer_id`
   null.
2. Brand onboards (`razorpay_linked_account_id` set).
3. `run()` → `{ retried: 1, succeeded: 1 }`; row's `razorpay_transfer_id` =
   `trf_mock_…`.
4. Second `run()` → `{ retried: 0 }` (idempotent).

## Invariant
Uses the already-recorded `tcs_amount` (no recompute → no drift); once
transferred, the row is no longer eligible.
