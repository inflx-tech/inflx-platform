# Impact

## Verdict

**One screen and a half, and the money chain runs end to end for the first time.** Everything under it
already exists — the endpoints, the payment helper, the escrow, the release.

## What changes

| Layer | Change |
|---|---|
| Mobile (brand) | `BrandWalletScreen` (new) and `BrandAddMoneyScreen` (new), registered in `BrandNavigator`; `WalletTab` stops being a placeholder |
| Mobile (brand) | `BrandAgreementScreen` — the shortfall button navigates in-app with the shortfall, and the screen refreshes on return |
| Mobile (shared) | `utils/openWebDashboard.js` — drop the `canOpenURL` gate |
| Backend | **nothing** |
| Website | **nothing** |

## Risks

| Risk | Severity | Guard |
|---|---|---|
| Opening Razorpay with a mock order crashes the app natively | **High** | Already handled in `services/payment.js`; the new screen must go through that helper and never call the SDK directly. Pinned by a test |
| "Money added" shown when the credit did not happen | **High** | Success is drawn only after the verify call returns success. A failed verify shows W7, never W6 |
| Double tap creates two payments | Medium | The button disables on the first tap; each attempt carries one order id |
| She returns to a stale agreement | Medium | The agreement refetches on focus, so the green box and the live Sign button are the server's answer, not a guess |
| Withdrawals look missing | Low | Out of scope and stated; the tab shows what it can do rather than a disabled thing it cannot |

## Release classification

**Production-impacting** — brand app only. One OTA, no migration, no backend, no website.

## What it unblocks

Act 6 of the walk, which is the first time the platform moves money: add ₹50,000, sign, watch ₹12,960
leave the wallet and ₹3,000 land in Asha's. Today that Act cannot be started at all.
