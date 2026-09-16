# Before / after — money on the phone

Mockups: `04-preview/mockups/brand-wallet.html` (W1–W9), locked 2026-09-16.

## Built as drawn

| Mockup | Built | Where |
|---|---|---|
| W1 · W2 Wallet tab | available large, locked and paid out beside it, Add money, the ledger underneath, empty state when there is nothing | `screens/brand/BrandWalletScreen.js`; `WalletTab` is a stack now, not `ComingSoonScreen` |
| W3 Add money | amount, four quick amounts, "commits nothing", one button | `screens/brand/BrandAddMoneyScreen.js` |
| W4 From an agreement | the exact shortfall pre-filled, its two halves named, "we'll bring you straight back" | same screen, `route.params: { need, forWhom, fee, campaignFee, returnTo }` |
| W5 Paying | spinner, "nothing has been taken if you cancelled", the test-mode paragraph | a phase inside the add screen |
| W6 Added | amount added, new balance, "Back to Asha's agreement", and the reminder that nothing is committed | a phase inside the add screen |
| W7 Cancelled or failed | plain, wallet unchanged, retry | a phase inside the add screen |
| W8 The agreement, fundable | unchanged screen — only the button's destination moved | `BrandAgreementScreen`, one `navigate` instead of one `openWebDashboard` |
| W9 Signed | unchanged screen | `BrandAgreementScreen` already drew it |

## One state the mockups did not have, added during the build

**"We couldn't confirm the payment."** W7 covers the honest cases — she cancelled, the bank refused —
and says *"nothing has been taken."* But there is a third case the drawing did not separate: the
payment **went through** and our confirmation call failed. Saying "nothing has been taken" there would
be a lie about her money, and saying "money added" would be a promise we cannot keep.

So a third state says exactly what is true: *"If money left your account it will be credited within a
few minutes. Check your wallet before trying again."* Pinned by a test that asserts neither of the
other two sentences can appear.

## What was NOT built, deliberately

- **Withdrawals** — founder, 2026-09-16: *"leave withdraw for now."* The endpoint exists; the screen
  shows what it can do rather than a disabled thing it cannot.
- **The locking and the 25% release** — already built and correct in `contractSign.brandSignInTx`.
  W9 draws what that code already does. Not one line of it was touched.
- **The Razorpay sheet** — that is Razorpay's screen. W5 is the moment on either side of it.

## The bug that rode along

`utils/openWebDashboard.js` asked Android *"is there a browser for this?"* before opening a link.
Since Android 11 an app must declare in `<queries>` that it intends to ask; this app never did, so the
answer was always **no**, and every "open the website" button in the app reported *"no browser
available"* on a phone with Chrome on it. `openURL` itself needs no declaration, so the check is gone.
That is why the add-money button appeared to do nothing.

## Evidence

- **12 new tests**, `screens/brand/__tests__/brandWallet.test.js`, including the two that matter:
  success is drawn only after the server confirms, and a paid-but-unconfirmed top-up claims neither
  outcome.
- **One existing test updated**: item 7's shortfall check asserted `openWebDashboard` was called. It
  now asserts the in-app navigation and its full payload. Intent unchanged — the button still has to
  take her somewhere useful.
- **Mobile suite: 542 passed, 0 failed** (serial), against 530 before — the 12 new ones, nothing else
  moved. No import cycles introduced.

## Still unproven until it runs on a phone

Every one of these tests mocks the payment helper. What they cannot prove is the real Razorpay path on
a device — and in production `RAZORPAY_MOCK=true`, so the first real run will take the simulated
branch. The first genuine card payment is a separate decision (turning the flag off) and a separate
verification.
