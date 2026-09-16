# brand-wallet-on-the-phone — workflow prediction

Mockups: `mockups/brand-wallet.html` (W1–W9).

| Screen | Predicted | To be built as |
|---|---|---|
| W1 · W2 Wallet tab | available big, locked and paid out beside it, Add money, the ledger underneath | new `screens/brand/BrandWalletScreen.js`, replacing `ComingSoonScreen` on `WalletTab` |
| W3 Add money | amount, quick picks, one button | new `screens/brand/BrandAddMoneyScreen.js` |
| W4 Add money, from an agreement | the same screen with a target: exact shortfall, what it is for, where it returns to | same screen, `route.params: { need, forWhom, returnTo }` |
| W5 Paying | spinner, "nothing has been taken if you cancelled", and the test-mode note | a state inside the add screen, using `services/payment.js` |
| W6 Added | new balance and the one button she wants — back to the agreement | a state inside the add screen |
| W7 Cancelled or failed | plain, wallet unchanged, retry | a state inside the add screen |
| W8 The agreement, fundable | the red box becomes the green one | **no new screen** — `BrandAgreementScreen` already draws both; only the button's destination changes |
| W9 Signed | what the signature did to the money | `BrandAgreementScreen`'s signed state, reading `locked_amount` and `released_amount` |

**Two things deliberately not drawn.** Withdrawals, which are out of scope. And the Razorpay sheet itself,
which is Razorpay's screen and not ours — W5 is the moment on either side of it.

**The one-line fix that rides along:** `utils/openWebDashboard.js` stops calling `canOpenURL` before
opening a link. That gate is why the current button fails on Android 11+, and it fails the same way for
every other "open the website" button in the app.

**What this contract does NOT touch:** the locking and the 25% release. Both are already built and
correct in `contractSign.brandSignInTx`. W9 draws what that code already does; it does not ask for new
behaviour.
