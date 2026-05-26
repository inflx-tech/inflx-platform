# Feature Spec — Flow 26 · brand-mobile Wallet

## Problem / goal

Ninth flow. BrandWalletScreen (645 LOC) — wallet balance hero + Razorpay top-up flow via WebView modal + payout bank details form + transaction history. SDK-heavy second only to Contract (Flow 27). Currently navy + orange legacy. Migrate to brandPalette + fonts.

## Scope

**In scope:**
- Visual rewrite consuming brandPalette + fonts (Outfit/PJS/JetBrains-Mono)
- Balance hero card: navy → ink, white text + yellow accents for balance value, mono digits
- Quick-amount chips (5K/10K/25K/50K): navy active → ink + yellow mono active
- Top-up CTA: navy + white → ink + yellow mono
- Bank details form: 5 PJS Medium inputs + mono labels + bg2 read-only style if needed
- Save Payout Details: navy + white → yellow + ink Outfit-Bold
- Transaction rows: emoji icons preserved, type label sansBold, ref + date mono small, +/- amount colored (credit = successText, debit = dangerText)
- Web link CTA: white card → bg2 card with brandPalette
- Razorpay WebView modal: navy header → ink header, "Cancel" link orange → yellow
- **HTML string color**: theme `'#1B2D5E'` → `'#0A0A0A'` (Razorpay modal theme inside the WebView)

**Preserve verbatim (SDK + flow):**
- `react-native-webview` WebView component
- `@react-native-async-storage/async-storage` session token check before topup/load
- buildRazorpayCheckoutHTML structure (only theme color string changes)
- 3 postMessage types: PAYMENT_SUCCESS / PAYMENT_FAILED / PAYMENT_DISMISSED
- Mock mode: `order_id.startsWith('order_mock_')` → auto-verify without WebView
- verifyPayment flow with wallet_balance refresh from response
- UNAUTHORIZED branch → navigate back to Auth via `navigation.getParent()?.reset(...)`
- onRequestClose Alert "Payment Cancelled"

**Out of scope:**
- theme/tokens.js changes
- ScreenHeader / StatusPill / EmptyState consumption (this screen has bespoke hero card + transaction list — extraction would force-fit; defer to polish pass)
- Razorpay SDK swap (still HTML+WebView)
- New transaction types or columns
- Backend / API changes

## Surfaces touched
- mobile-brand: 1 screen file

## Data / contracts
- **APIs**: getWallet, getWalletTransactions, getMe, createTopup (rupees → returns Razorpay order_id/amount/key_id), verifyTopup (razorpay_order_id/payment_id/signature → returns wallet_balance), updateMe (listing_data.bank_details) — all unchanged
- **Money**: balance / escrow_locked / total_deposited / tx amount in paise (per existing comment: "stored in PAISE in the DB — fmtMoney handles the /100 conversion"). Quick-amount chips show fmtRupees(amt) for human-readable display
- **Storage**: AsyncStorage `inflx_token` session check
- **Razorpay**: real Razorpay test key + checkout.js CDN OR mock order ID with auto-verify

## Non-functional
- Auth: AsyncStorage token check at load() and topup() entry; UNAUTHORIZED responses → reset nav to Auth
- KeyboardAvoidingView NOT used (ScrollView handles keyboard via OS default)
- Failure modes: session expired → Alert+reset; topup createTopup failure → Alert; verifyTopup failure → Alert "If amount was debited, it will be refunded"; bank details validation (holder/account/IFSC required) → Alert; Modal onRequestClose → Alert "Payment Cancelled"
