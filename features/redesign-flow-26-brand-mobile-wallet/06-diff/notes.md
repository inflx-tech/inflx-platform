# Flow 26 — before/after diff notes

## Files touched
- **Modified**: `Packages/Mobile/src/screens/brand/BrandWalletScreen.js` — full visual rewrite, behavior preserved 1:1, SDK boundary preserved verbatim. ONE color string change inside `buildRazorpayCheckoutHTML`.
- **NOT touched**: theme/tokens.js, react-native-webview, AsyncStorage, Razorpay checkout.js CDN, StatusPill / ScreenHeader / EmptyState (Wallet has bespoke hero + tx list patterns — not a fit for the extracted components)

## Visual delta
| Element | Before | After |
|---|---|---|
| Header bg | colors.navyDeep | brandPalette.ink |
| Title | system bold 22 white | Outfit-Bold 22 white -0.3 letterSpacing |
| Balance card bg | colors.navy | brandPalette.ink (deeper, same family) |
| Balance label | system 11 white-60 uppercase letterSpacing 1 | mono-Bold 10 white-55 uppercase letterSpacing 1 |
| Balance amount | system 36 white | JetBrains-Mono 34 white -0.5 letterSpacing |
| Mini-stat label | system 10 white-50 | mono-Bold 9.5 white-50 uppercase letterSpacing 0.4 |
| Mini-stat value | system 16 white | **mono-Bold 15 yellow** (new accent — was white) |
| Section title | system 15 bold t1 | Outfit-Bold 13 ink uppercase letterSpacing 0.4 |
| Quick chip | surface2 + t2 / navy + white | bg2 + muted sansBold / ink + yellow mono-Bold active |
| Top Up button | navy + white system bold 14 | ink + yellow mono-Bold 13 letterSpacing 0.2 |
| Top Up disabled spinner | white ActivityIndicator | yellow ActivityIndicator |
| Top Up input border | border2 / 2px | border / 2px (token swap) |
| Rupee prefix | system 16 bold t2 | mono-Bold 16 muted |
| Topup field | system 16 t1 | mono-Medium 15 ink |
| Verifying row | navyPale + navy | yellowPale + yellowText |
| Bank hint | system 11 t3 | PJS-Medium 11 muted2 |
| Bank label | system 11 bold t2 | mono-Bold 9.5 muted uppercase letterSpacing 0.4 |
| Bank input | system 14 t1 + border + white bg | PJS-Medium 13 ink + border + white bg (mono for Account/IFSC/UPI) |
| Save Payout Details | navy + white system bold 14 | yellow + ink Outfit-Bold 13.5 letterSpacing 0.3 (canonical primary) |
| Tx empty | system 13 t3 | PJS-Medium 12.5 muted2 |
| Tx type | system 13 t1 600 | PJS-Bold 12.5 ink 700 |
| Tx ref + date | system 10 t3 | mono-Medium 9.5 muted3 |
| Tx amount credit | colors.teal | successText (slight darker green for AA contrast) |
| Tx amount debit | colors.red | dangerText |
| Tx amount weight | system 14 bold | mono-Bold 13.5 |
| Web link | colors.navy text | brandPalette.ink text + sansBold |
| WebView header bg | colors.navyDeep | brandPalette.ink |
| WebView title | system 16 bold white | Outfit-Bold 15 white |
| WebView Cancel link | colors.orange | yellow sansBold |
| WebView loading spinner | navy | yellow + PJS muted copy |

## HTML string substitution (inside `buildRazorpayCheckoutHTML`)
| Line | Before | After |
|---|---|---|
| body bg | `#F4F6FB` (navy-tinted) | `#FAFAFA` (brandPalette.bg) |
| loader text | `#4A5278` (navy muted) | `#52525B` (brandPalette.muted) |
| spinner ring | `#E0E4EF` (navy border) | `#E4E4E7` (brandPalette.border) |
| spinner accent | `#1B2D5E` (navy) | `#0A0A0A` (brandPalette.ink) |
| Razorpay theme.color | `#1B2D5E` | `#0A0A0A` |

Razorpay accepts any hex; their UI accent updates to match `theme.color`. No semantic change.

## Behavior delta — zero behavioral change

**SDK boundary preserved verbatim:**
| SDK / API | Status |
|---|---|
| AsyncStorage session token check at load + topup entry | Preserved verbatim (Alert + getParent().reset() on missing) |
| getWallet + getWalletTransactions + getMe in parallel | Preserved verbatim |
| UNAUTHORIZED response branch → Alert + nav reset | Preserved verbatim |
| createTopup(amountRupees) → { order_id, amount, key_id } | Preserved verbatim |
| Mock branching: `order_id.startsWith('order_mock_')` → auto-verify with `pay_mock_${Date.now()}` + 'mock_signature' | Preserved verbatim |
| buildRazorpayCheckoutHTML structure (key/amount/order) | Preserved verbatim (only theme color + body bg + loader colors changed) |
| Razorpay checkout.js CDN load | Preserved (URL unchanged) |
| 3 message types: PAYMENT_SUCCESS / PAYMENT_FAILED / PAYMENT_DISMISSED | Preserved verbatim |
| verifyTopup payload shape | Preserved verbatim |
| wallet_balance update from verify response | Preserved verbatim |
| Modal onRequestClose Alert "Payment Cancelled" | Preserved verbatim |
| Bank save: listing_data.bank_details payload shape | Preserved verbatim |
| Bank validation (holder/account/IFSC required) | Preserved verbatim |
| Pincode-style auto-uppercase IFSC, numeric-only account number, max-11 IFSC | Preserved verbatim |
| Money: fmtMoney for paise/100 conversion, fmtRupees for quick-chip display | Preserved verbatim |
| TX_ICONS + TX_LABELS maps | Preserved verbatim |
| Credit set ['topup', 'escrow_release', 'refund'] | Preserved verbatim |
| Transactions.slice(0, 15) limit | Preserved verbatim |
| openWebDashboard('/dashboard/wallet') | Preserved verbatim |

## SDK boundary — explicit preservation
- `react-native-webview` Modal+WebView: NOT modified
- `@react-native-async-storage/async-storage`: NOT modified
- Razorpay checkout.js (CDN-loaded inside WebView): NOT modified
- Razorpay modal accent now uses `#0A0A0A` (brandPalette.ink) instead of `#1B2D5E` (navy) — this is the only semantically observable change for the user during Razorpay payment

NATIVE_RUNTIME: NOT bumped. No new native modules added.

## Wave-3 follower regression check
theme/tokens.js unchanged. 24 Wave-3 follower screens byte-identical.

## QA classification expectation
Per Flow 24/25 precedent: pre-warm backend → expect clean GREEN. If env-flake recurs (MSG91 / Render cold-start), classify per Flow 19/21/23/25 — ship pending-cert. Flow 26 touched 1 mobile screen — zero web/backend/qa changes — zero causal path to brand-web or API failures.

## What's NOT in this flow
- BalanceCard component extraction (single-use, defer)
- Multiple transaction-type filters (out of scope)
- Withdrawal flow (different screen entirely)
- Razorpay-SDK swap to native module (still HTML+WebView)
