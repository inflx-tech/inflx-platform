# Workflow — money on the phone

## The walk that could not happen before

1. Kanchi Silks opens Asha's agreement. She has signed; the brand has not.
2. The screen shows what it costs — ₹12,000 for Asha, ₹960 campaign fee, ₹12,960 to lock — and,
   because the wallet is empty, a red box: **Add ₹12,960 to wallet**.
3. She taps it. **(This is where it ended before: "no browser available".)**
4. **Add money** opens, inside the app, already filled with ₹12,960, saying what the money is for and
   that she will be brought straight back.
5. She taps **Add ₹12,960**. The payment step runs — simulated while the platform is in test mode,
   which the screen says out loud.
6. **₹12,960 added.** Her wallet shows it, and one button: **Back to Asha's agreement**.
7. The agreement reloads on focus. The red box is now green — *"You have enough"* — and
   **Sign and lock ₹12,960** is live.
8. She signs. The server locks ₹12,960, writes the ledger, creates the three payments and
   **releases ₹3,000 to Asha immediately**.
9. Asha is told: *"Kanchi Silks signed. ₹3,000 is in your wallet."*
10. Back in the Wallet tab: available down by ₹12,960, **locked ₹9,000**, **paid out ₹3,000**, and
    four new rows in the ledger.

Steps 8 and 9 were already built. Steps 3 to 7 are this contract.

## The walk from the tab

1. Wallet tab → **Add money** → amount or a quick amount → **Add** → added → **Stay in Wallet**.
2. Nothing is committed to anyone. The money waits for a signature.

## When it goes wrong

- **She cancels at the payment sheet** → *"Payment not completed. Nothing has been taken."* One tap to
  retry. The server is never asked to confirm anything.
- **The bank refuses** → the same.
- **The payment succeeds and our confirmation fails** → a different message, because a different thing
  is true: *"We couldn't confirm the payment. If money left your account it will be credited within a
  few minutes."* Never "nothing was taken" — we do not know that. Never "money added" — we cannot
  promise it.
- **She adds less than the shortfall** → allowed. She returns to an agreement that still says what is
  missing.
- **She never comes back** → nothing is committed. The money sits in her wallet.

## Order of build

1. The words (`components/wallet/copyW.js`) — including the two load-bearing sentences.
2. `BrandWalletScreen` (W1, W2), and the Wallet tab becomes a stack so Add money can push over it.
3. `BrandAddMoneyScreen` (W3–W7), every phase in one screen.
4. The agreement's button: in-app, carrying the shortfall, its parts, and where to return.
5. `openWebDashboard`: drop the `canOpenURL` gate.
6. Tests, including the paid-but-unconfirmed case.
