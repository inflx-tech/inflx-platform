# Expected Outputs — Flow 26

## Hero / Balance card
- Ink topbar w/ Outfit-Bold 22 "Wallet" white
- Balance card: ink bg + 16 radius. "AVAILABLE BALANCE" mono uppercase (rgba white 0.55). Huge mono fmtMoney(balance) — JetBrains-Mono 36pt 900 white. Below 2 mini-stats: mono uppercase labels (muted white) + mono Bold values (white).

## Add Funds section
- Section title: Outfit-Bold 13 ink uppercase
- 4 quick chips in row: flex:1, 10 radius, bg2 inactive / ink active. PJS-Bold 12 muted inactive / mono-Bold 12 yellow active. Each shows fmtRupees(5000/10000/25000/50000).
- Custom amount row: rupee prefix (mono 16 muted) + monoMedium 16 ink input. Border 2px brandPalette.border. 12 radius.
- Top Up button: ink + yellow Outfit-Bold "Top Up". Disabled state opacity 0.5.
- Verifying state row: bg yellowPale + yellowText copy "Verifying payment…" with small spinner.

## Payout Details section
- Section title + hint sub (PJS Medium 11 muted2 "Where refunds and payouts will land.")
- Field stack: mono-Bold 10 muted uppercase label + PJS-Medium 13 input (white bg + border, 8 radius). Account number → numeric-only, IFSC → auto-uppercase + monoMedium font + max 11, UPI → no auto-capitalize.
- Save Payout Details: yellow + ink Outfit-Bold (canonical primary). Disabled state opacity 0.5.

## Transactions section
- Section title Outfit-Bold uppercase
- Per row: emoji icon left + middle (type label PJS-Bold 13 ink + optional ref mono 10 muted3 + date mono 10 muted3) + amount right (mono-Bold 14, color = success/danger by credit/debit)
- Empty: "No transactions yet. Top up your wallet to get started." PJS Medium muted

## Web link CTA
- White card + brandPalette.border + 14 radius. Mono icon 🌐 + PJS-Bold "View full transaction history on web" + mono chevron.

## Razorpay WebView modal
- Modal header: ink bg + Outfit-Bold "Razorpay Payment" white centered. Cancel button left = yellow text sansBold.
- WebView body: HTML embeds checkout.js with theme color '#0A0A0A' (was '#1B2D5E') — only string substitution in HTML.
- Loading state: ink ActivityIndicator + PJS muted "Loading payment gateway…"

## Razorpay HTML theme color
**ONE STRING SUBSTITUTION**: `theme: { color: '#1B2D5E' }` → `theme: { color: '#0A0A0A' }` (inside buildRazorpayCheckoutHTML). Razorpay modal's accent in their UI follows brandPalette.

## Data assertions
- createTopup payload: amountRupees (parseFloat) — backend converts to paise
- verifyTopup payload: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- Mock detection: `order_id.startsWith('order_mock_')` → bypass WebView; pass `pay_mock_${Date.now()}` + 'mock_signature' to verifyPayment
- Bank save payload: `{ listing_data: { ...currentLd, bank_details: { account_holder_name, bank_name, account_number, ifsc_code, upi_id } } }`
- Money: balance/escrow/deposited stored in paise; fmtMoney handles /100 (preserved behavior)
- Quick-chip display: fmtRupees(amt) (human-readable; chip is a UI shortcut, value goes through fmtMoney conversion at top-up time)
- Transaction credit set: `['topup', 'escrow_release', 'refund']`

## Visual evidence
`design/wave2/flow-26-brand-mobile-wallet/web.html` — 1 phone (balance + add funds + transactions) + 1 modal thumbnail (Razorpay WebView)
