# Expected outputs

| # | Expect | Where proved |
|---|---|---|
| 1 | The Wallet tab shows available, locked and paid out from the wallet endpoint's own fields | `brandWallet.test.js` |
| 2 | The ledger reads in her words — "Money added", "Locked for Asha M.", "Campaign fee", "Paid to Asha M." — with + and − | same |
| 3 | An empty wallet says so rather than showing a blank | same |
| 4 | A wallet whose ledger fails to load still shows the balance | same |
| 5 | Add money from the tab pre-fills nothing and says adding money commits nothing | same |
| 6 | Add money from an agreement pre-fills the EXACT shortfall and names its two halves | same |
| 7 | An empty or absurd amount is refused without calling the server | same |
| 8 | A successful top-up shows the amount, the new balance, and a button back to the agreement | same |
| 9 | A cancelled payment says nothing was taken, and never asks the server to confirm | same |
| 10 | **A payment that succeeded but could not be confirmed says neither "nothing was taken" nor "money added"** | same |
| 11 | The screen never hands an order to the Razorpay SDK directly — always through `services/payment.js` | same |
| 12 | A refused top-up order stops before any payment is attempted | same |
| 13 | The agreement's shortfall button navigates in-app with `need`, `forWhom`, `fee`, `campaignFee`, `returnTo` | `item7Brand.test.js` |
| 14 | Returning to the agreement refreshes it, so the green box and the live Sign button come from the server | by construction: `useFocusEffect` reload |
| 15 | No import cycles introduced | cycle scan, 0 |
| 16 | No regression | full mobile suite, 542 pass / 0 fail vs 530 before |

## Not proved here, and said plainly

The real Razorpay sheet on a real device. Every test mocks the payment helper, and production runs
`RAZORPAY_MOCK=true`, so the first live run takes the simulated branch. The first genuine card payment
is a separate decision and a separate verification.
