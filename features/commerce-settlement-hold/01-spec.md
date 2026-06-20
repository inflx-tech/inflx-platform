# Feature Spec — Commerce Settlement Hold + Influencer Ledger (G-3 + G-5)

> Hold the brand's commerce payout until each order's return window closes; reverse only
> the returned item's share on a refund; give influencers a real append-only ledger.
> Money-rule LOCKED by founder 2026-06-20 (project_g3_payout_timing). Backend-only.

## Problem / goal
Today the brand is paid (Razorpay Route transfer) IMMEDIATELY at sale, before any return
window, with no claw-back. Only the influencer's commission is held. And influencers have no
ledger (balances are denormalized columns). Goal: hold the brand payout until the order's
return window closes, refund/clawback per returned item, release the kept remainder, and add
an influencer ledger.

## Scope
- In scope (backend): defer brand settlement to a post-window cron; per-item pro-rated
  claw-back on refund; fix the live bug where one returned item froze the WHOLE order's
  commission; influencer_ledger table + write points at every balance mutation; GET
  /influencers/me/ledger.
- Out of scope / FOLLOW-UP: mobile influencer wallet/ledger UI; brand "pending payout" web view.
- Out of scope: changing the customer refund mechanism (admin still sets refund_amount).

## Model (confirmed)
An order is single-brand → single category → ONE return window per order. So per-item only
matters for PARTIAL RETURNS (return 1 of 3 → reverse that item's pro-rated share; the kept
items release together at the window). Single-purchase flows (pay-at-store/store-offer/
prebook/prebook-daterange) are 1 item = per-transaction.

## Data / contracts
- Migration 112: follower_transactions +brand_settlement_status (pending|settled|reversed|skipped)
  +brand_settled_at +commission_reversed +brand_net_reversed; backfill legacy paid rows
  (tcs_amount NOT NULL) → 'settled' so the new job never re-pays them. follower_returns
  +reversed_commission +reversed_at (claw-back idempotency). New influencer_ledger table.
- Defer: remove the 5 sale-time settleCommerceTransaction calls; new commerce-settlement.job
  (00:05 IST) settles brand_net − brand_net_reversed for txns past window with no OPEN return.
- Claw-back (adminMarkRefunded → clawbackOnRefund): pro-rate by returned line's items_json share;
  reverse from pending (if unconfirmed) or wallet (if confirmed); idempotent on reversed_at;
  whole-order flip keyed on BRAND NET remainder (not commission).
- commission-confirm: now releases NET (commission − commission_reversed), blocks only on OPEN
  returns (not refunded) — fixes the all-or-nothing freeze.
- influencer_ledger appended at: sale-commission-pending, commission-confirm, tranche-release,
  withdrawal + reversals, enquiry-commission, referral-accrual, return-clawback.

## Non-functional
- Idempotency: settle (status filter + tcs guard + legacy backfill); claw-back (reversed_at);
  confirm (commission_confirmed_at).
- Ledger is best-effort audit (never blocks the money op); informational, not the balance source.
- RAZORPAY_MOCK=true in prod today → no real transfers; see Risk (C1) — HARD gate before Route go-live.
