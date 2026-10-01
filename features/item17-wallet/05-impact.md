# item17-wallet — impact (final, after build)

**Production-impacting and money-moving. Explicit go required before migrate, push or OTA.**

## What changes for people
- **Brand** (phone + website): the Wallet shows Available, On hold, Locked in collaborations and
  Sales money coming. Sales money is added to the wallet when each return window closes. Withdraw is
  a request: on hold at once, paid by INFLX, then marked processed.
- **Creator** (phone): the stand-in wallet is replaced — Available, On hold, Still to come
  (collaboration payments with dates; commission sale by sale). Withdrawals are requests, paid in
  full: no tax is deducted and none is mentioned.
- **Admin** (website): one Money section replaces Escrow and Payouts — overview, withdrawals,
  balances, sales, collaboration money, money added, all movements, disputes & corrections, settings.
- **Nobody can cancel a campaign once a collaboration in it is signed by both.**

## What it touches
| Layer | Change |
|---|---|
| Database | Migration **200** — additive: `withdrawal_hold` on brands and influencers; tables `withdrawal_requests`, `wallet_topup_orders`, `money_corrections`; five ledger types; `wallet_transactions.source_ref_id`; one unique index (one credit per payment); setting `withdrawal_process_hours` = 24. **The migration moves no money** (read before and after). |
| Server | New: `withdrawalRequest`, `walletRead`, `adminMoney` services; `item17.routes` (creator wallet, `/admin/money/*`). Changed: `settlement.service` (credit the wallet, no Route transfer, no order dues), `commerce-settlement` + `commission-confirm` jobs (cash counts once delivered), `settlement-retry` job (no-op), `wallet.controller` (top-up credited once; reads; withdraw), `withdrawal.controller` + `influencer.routes` (old addresses run the new model; retry = 410), `admin.routes` (old approve endpoints = 410), `campaign.controller` (cancel refused after signing), `escrow.service` (a payment's ledger row names its escrow row), `adminOrders.controller` (sales summary fixed), `platformSettings.service` (the 24 hours). |
| Phone | Brand: Wallet tab rebuilt + 8 screens. Creator: Wallet tab rebuilt + 6 screens. Shared `screens/wallet/*`, `components/wallet/copy17.js`, `bits17.js`. OTA influencer + brand. |
| Website | Brand Wallet page rebuilt; old payout-account page → Wallet. Admin: nine Money pages, navigation, Escrow/Payouts addresses → Money; TDS note on Payment Config. Vercel deploys on push. |

## Money behaviour that changes at deploy (not at the migration)
1. A sale whose return window has closed adds the brand's share to its **wallet** (was: a dormant
   bank-transfer path). Production today: 16 old test orders are still marked "pending"; none came
   through the shopper checkout, so the job never touches them: they stay as they are and **nothing is credited**.
2. A cash-on-delivery sale waits for **Delivered**; then its window runs from the delivery.
3. A withdrawal no longer leaves by itself: it waits in Admin → Money → Withdrawals.
4. No TDS is deducted at withdrawal.
5. The old approve/reject endpoints and the automatic retry answer 410.

## Production read before deploying (dry run, 1 Oct 2026 — nothing written)
No payment credited twice · no old withdrawal requests of either kind · no open brand dues · no
brand with bank details only in the old store · brand wallets ₹0, creator wallets ₹8,625 (one
creator, no payment details saved yet), escrow ₹34,500 (₹8,625 released), contracts locked ₹36,260.

## Payments are in TEST MODE in production today
The production server simulates payments (RAZORPAY_MOCK). Money a brand "adds", and every shopper
"payment", is not real money — but a withdrawal paid from INFLX's bank IS. Admin → Money shows a red
TEST MODE banner on the Overview, on Withdrawals and inside "Mark processed". Until live payments
are switched on, mark a withdrawal processed only to walk the flow — do not send money from the bank.

## Found by the pre-deploy review and fixed before deploy
See `06-diff/notes.md` → "Pre-deploy review". In short: a sale is added to the wallets only once
its parcel has shipped; only shopper-checkout sales become wallet money; a top-up must be an
add-money order of that brand; INFLX's release tool names the payment and keeps the collaboration
in step; the creator's commission credit is atomic.

## Risks, and what holds them
- *A payment credited twice* — order row locked + status compare-and-swap + unique index.
- *Two taps / two admins on a withdrawal* — owner row locked; request status compare-and-swap; one
  open request per person by a unique index.
- *Held money spent* — the hold leaves `wallet_balance`, which is what every spend path reads.
- *A sale settled twice or marked without the money* — one transaction per sale, status as the swap.
- *An admin tool sending money out* — none can: all three only move money into or out of a wallet.

## Not in this item
Taxes and invoices (W8) · returns in the shopper app (W10) · dispute screens for brand and creator
(item 18) · connecting the delivery partner for cash collection (the Delivered status stands in).

## Rollback
Code: revert the commit and republish the previous OTA bundles. Database: migration 200 is additive
and can stay. Any withdrawal requested in between stays in `withdrawal_requests` with its hold; it
must be processed or released from Admin before the old code is trusted with that wallet.
