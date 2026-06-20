# Workflow Definition — Commerce Settlement Hold + Ledger (G-3 + G-5)

## Actor
Follower (buys/returns), influencer (earns), admin (refunds), system crons.

## Preconditions
Migration 112 applied; ENABLE_CRONS on in prod.

## Workflow steps (user-observable / system)
1. A follower buys via a creator → influencer commission goes to pending_balance (ledger:
   sale_commission_pending); the brand is NOT paid yet (brand_settlement_status='pending').
2. No return by the time the order's return window closes → the nightly commerce-settlement
   job pays the brand (net of any returns) and commission-confirm moves the influencer's
   commission pending→wallet (ledger: commission_confirm).
3. A customer returns ONE item of a multi-item order and admin marks it refunded → only that
   item's pro-rated commission is reversed (ledger: return_clawback) and that item's brand_net
   is excluded; the OTHER items keep holding and settle at the window.
4. A whole order is returned → brand is paid nothing (status reversed); influencer commission
   fully reversed.
5. An influencer opens GET /influencers/me/ledger → sees every credit/debit with a running balance.

## Success definition
- Brand receives commerce money only AFTER the return window, minus returned items.
- Returning one item reverses only that item; the rest are unaffected and still release.
- Influencer ledger reconciles with wallet_balance/pending_balance movements.

## Failure / edge workflows
- Open (unresolved) return at window close → settlement holds until it resolves.
- Refund claw-back runs once (reversed_at guard); double mark-refunded is a no-op.
- Legacy already-paid orders are never re-paid (backfilled 'settled').
- RAZORPAY_MOCK=true → transfers are synthetic; logic still exercised end-to-end.
