# Money on the phone — the brand wallet

**Asked for:** founder, 2026-09-16, from the agreement screen: *"when I click on add money into wallet it
is crashing, path should open adding funds to wallet… after adding funds and brand sign, funds should
lock, after signing the first 25% should be released to creator wallet."*

---

## 1. What is broken, precisely

**The button does not open anything.** It calls `openWebDashboard('/dashboard/wallet')`, which asks
Android *"is there a browser for this?"* before opening. Since Android 11 an app must **declare** that it
wants to ask that question, in a `<queries>` block in the manifest. This app never declares it, so Android
answers **no**, and the code shows *"Cannot Open Browser — no browser is available"* on a phone with
Chrome on it. Verified: there is no `<queries>` block in `AndroidManifest.xml`.

**And there is nowhere for it to go anyway.** The brand app's Wallet tab is `ComingSoonScreen`. There is
no wallet, no balance and no top-up anywhere in the brand app.

**The consequence is the whole money chain.** No brand can put money in from the phone, so no brand can
sign, so no creator has ever been paid. Production has never moved a rupee.

## 2. What is NOT broken — checked, not assumed

The founder's second ask — lock the funds, release the first 25% — **is already built and correct**.
`contractSign.brandSignInTx` does, in one transaction:

1. locks the contract row first, so a double tap cannot sign twice;
2. reads the wallet `FOR UPDATE`, and refuses with `WALLET_INSUFFICIENT` naming the shortfall;
3. debits the wallet once and writes two ledger rows — `escrow_lock` for her fee, `platform_fee` for the 8%;
4. writes the signature as a compare-and-swap;
5. creates the three escrow entries (25 / 25 / 50) and **releases the first to her immediately**;
6. opens the shoot or shipment step, and creates the deliverables.

Nothing in this section is being rebuilt. It has simply never been reachable.

## 3. Scope

**In scope**

- A real **Wallet tab**: available, locked, paid out, recent activity (W1, W2).
- An **Add money** screen (W3), which also accepts a target: the exact shortfall and what it is for (W4).
- The paying, added, and cancelled states (W5, W6, W7).
- The agreement's shortfall button navigates **in-app** and returns to the agreement, refreshed (W6 → W8).
- Drop the `canOpenURL` gate from `openWebDashboard` — the same bug sits behind every other
  "open the website" button in the app.

**Out of scope**

- Withdrawals. The endpoint exists; a brand taking money back out is its own decision and its own screens.
- Turning off `RAZORPAY_MOCK`. Going live with real payments is the founder's call, separately.
- Anything in the signing or escrow code (section 2).

## 4. The screens

`04-preview/mockups/brand-wallet.html` — W1 to W9, drawn in the app's own tokens.

Three decisions live inside them:

1. **The shortfall is offered exactly** — ₹12,960, not rounded up to ₹25,000. She may choose more; the
   screen does not choose for her.
2. **Adding money commits nothing**, said on both the add screen and the success screen. A brand who
   fears that adding money spends it will not add money.
3. **Test mode is admitted, not hidden.** W5 says plainly that no real money moves yet. When live
   payments are switched on, that paragraph goes and not one screen changes.

## 5. Every number traces to a field that exists

| On screen | Field | Endpoint |
|---|---|---|
| Available to spend | `available_balance` | GET /brands/me/wallet |
| Locked in agreements | `reserved_balance` | GET /brands/me/wallet |
| Paid out to creators | `settled_balance` | GET /brands/me/wallet |
| Activity rows | `type · notes · amount · direction · created_at` | GET /brands/me/wallet/transactions |
| The shortfall and its parts | `shortfall · totalToLock · availableBalance` | already on the agreement screen |
| ₹3,000 / ₹3,000 / ₹6,000 | `payouts.t1 · t2 · t3` | already on the agreement screen |

Nothing is computed in the app.

## 6. Payment, and the two modes

`services/payment.js` already handles both, and already carries the scar: opening the Razorpay sheet with
a mock order id **crashes the app natively**, so the helper detects `order_mock_…` and simulates instead.
Production is `RAZORPAY_MOCK=true` today, so a top-up completes without a card. The same screens become a
real payment sheet when the flag flips — no screen changes.

## 7. Failure modes

| If | Then |
|---|---|
| She cancels at the payment sheet | W7. Nothing taken, wallet unchanged, one tap to retry |
| The verify call fails after payment | Never say it succeeded. Show W7 with "if money left your account it will be credited within a few minutes"; the ledger settles it |
| She adds less than the shortfall | Allowed. She returns to an agreement that still says what is missing |
| She adds money and never returns | Nothing is committed. The money waits |
| Two taps on Add | The button disables on the first; each attempt carries one order id |

## 8. Classification

**Production-impacting** — brand app only. One OTA. No migration, no backend change, no website change.
