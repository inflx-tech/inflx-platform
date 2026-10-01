# item17-wallet — spec

**Item 17 of 21: Wallet, complete.** Master rules **v1.31 §17A** (written 1 Oct 2026 from the
founder's decisions), with §3, §10, §17, §18, §21, §26. Builds on items 9, 11, 12, 15 (escrow and
releases), 16 (the per-item three-way split on `order_lines`) and the existing wallet code.

## Founder decisions (1 Oct 2026)
| # | Decision |
|---|---|
| W1 | **No cancellation after both sign.** Non-performance is a dispute INFLX handles. `POST /campaigns/:id/cancel` must refuse once any collaboration is signed; its refund path goes. |
| W2 | **Sales money lands in INFLX's own account**, in nobody's wallet. The brand sees each sale's three shares; the creator sees her commission alone. |
| W3 | When the return window closes, the brand's share is **added to the brand's wallet** and the creator's commission to hers. The brand may fund its next collaboration with it. Razorpay Route auto-transfer is **retired**. |
| W4 | **Cash on delivery:** INFLX collects through the delivery partner; once delivered it behaves as an online order. `brand_dues` for orders is **switched off**. Until the partner is connected, the order's Delivered status is the confirmation. |
| W5 | **All money out is a withdrawal request** (brand and creator; phone, and website for the brand). The amount goes **on hold** at once ("processed within 24 hours"); INFLX pays from its bank and marks **Processed** — only then the balance drops. **Could not process** (reason) releases the hold. No approval step, no automatic payout (RazorpayX retired). One open request at a time; minimum = `min_withdrawal_inr`. |
| W6 | **TDS paused:** the full amount is paid; no screen mentions TDS. |
| W7 | **Fix every money fault** found by the survey (below). The return claw-back is fixed with the returns item (the new shopper app has no Return yet). |
| W8 | **Taxes and invoices** (TDS, TCS, GST, invoices, tax certificate) are a later round. |
| W9 | **Admin: all money in one place** — its own board, after the apps board. |
| W10 | Returns in the shopper app are their own item after the wallet; deal items return together. |

## State today (survey 1 Oct 2026 — verify each before building on it)
- Brand: add money works (phone + web) but `verifyTopup` can credit one payment twice; the wallet
  shows one "reserved" total computed from ledger rows (ignores courier holds and the campaign fee);
  withdrawal is website-only, admin approve/reject, and reads `listing_data.bank_details` while
  the phone writes `brands.bank_account_no` — unreachable for new brands.
- Sales: split frozen per item; brand share settled by the `commerce-settlement` job via Razorpay
  Route (dormant, mock) to a bank account — never to the wallet; COD creates `brand_dues`.
- Creator: `influencer_ledger` and `/influencers/me/earnings` hold everything, the phone shows a
  stand-in; `POST /influencers/me/withdraw` pays out automatically with TDS; `retryWithdrawal` can
  refund twice; concurrent requests can overdraw.
- Admin: brand and creator withdrawals on separate pages; `/admin/commerce-summary` errors
  (renamed column); the campaign fee is in no revenue figure.
- `POST /campaigns/:id/cancel` refunds locked escrow after signing (and crashes on an enum value).

## What item 17 delivers (apps + server; the Admin board follows)
1. **Brand wallet read**: Available, On hold, Locked in collaborations (per collaboration, from
   escrow rows), Sales money coming; sales list with three shares and state; history in plain words.
2. **Creator wallet read**: Available, On hold, Still to come (collaboration payments with dates;
   commission per collaboration and per sale); history.
3. **Sales settlement to wallets** at window close (brand share → brand wallet; commission as today),
   COD included once delivered; Route transfer and order `brand_dues` retired.
4. **One withdrawal model** for both: request → hold → Processed / Could not process; no TDS.
5. **Phone screens** BW1–BW10, CW1–CW7 (board `item17-wallet-apps-v1.html`); the brand website
   wallet brought to the same model.
6. **Fixes**: top-up idempotency; cancel-after-signing refused; one bank-details store; retired
   retry and auto-payout paths; admin sales summary; campaign fee counted as INFLX earnings.

Not in item 17: taxes and invoices (W8); returns (W10); disputes screens (item 18).
