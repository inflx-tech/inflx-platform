# 06 — Implementation / diff notes (Commerce Settlement Hold + Ledger, G-3 + G-5)

Backend-only money change (no UI → not UI-governed). Two adversarial money reviewers; QA GREEN.

## What was implemented
- G-3 defer: removed the 5 sale-time settleCommerceTransaction calls (transaction.controller.js);
  new commerce-settlement.job.js (00:05 IST) settles brand_net − brand_net_reversed for txns past
  their return window with no OPEN return; settleCommerceTransaction/retryTransfer now net-of-returns.
- G-3 claw-back (returns.controller.js clawbackOnRefund, idempotent on reversed_at): pro-rate the
  returned line's share from follower_orders.items_json; reverse that share from pending (unconfirmed)
  or wallet (confirmed); accumulate commission_reversed/brand_net_reversed; whole-order flip keyed on
  BRAND NET remainder.
- Bug fix: commission-confirm.job now releases NET commission and blocks only on OPEN returns — one
  returned item no longer freezes the whole order's commission.
- G-5: influencer_ledger table + ledger.service.appendInfluencerLedger (best-effort, balance_after via
  RETURNING) wired at 8 write points; GET /influencers/me/ledger (self-scoped, paginated).
- Migration 112 (additive + legacy backfill to 'settled').

## Reviewer findings + resolution
- CRITICAL C1 (Route double-pay on crash) — DORMANT (RAZORPAY_MOCK=true in prod); pre-existing; documented
  in 05-impact as a HARD gate before Route launch. NOT fixed here (needs real-Route idempotency + testing).
- MEDIUM-1 (brand under-pay on uneven partial return) — FIXED: whole-order detection now keyed on brand_net.
- LOW-3 (total_earned drift on confirmed-then-returned) — FIXED.
- LOW-1/LOW-2/GST-on-partial — accepted/noted in 05-impact.

## What diverged / deferred (follow-ups)
- Mobile influencer ledger/wallet screen + brand "pending payout" web view (backend ready).
- C1 Razorpay idempotency hardening (REQUIRED before RAZORPAY_MOCK=false).
- GST pro-ration on partial returns (finance review).

## What to check after deploy (migration 112 applied first; mock mode)
- New sale → brand_settlement_status='pending'; brand not paid at sale.
- Run commerce-settlement.job (or wait for cron) past a test window → brand 'settled' (synthetic transfer).
- Refund one item of a multi-item order → only that item's commission reversed; ledger shows return_clawback;
  other items still settle.
- GET /influencers/me/ledger returns the influencer's rows.
