# Workflow Definition — Flow 26

## Actor
Logged-in brand on mobile app, reaches Wallet from bottom-tab or Home top-up CTA.

## Preconditions
- Brand profile exists with valid session token in AsyncStorage
- Wallet exists (created during brand registration)

## Workflow steps

### Path A — View balance
1. Mount: ScrollView. Load: AsyncStorage check → 3 parallel APIs (getWallet, getWalletTransactions, getMe).
2. Loading → centered yellow ActivityIndicator.
3. Hero header: ink topbar w/ "Wallet" title.
4. Balance card: ink bg + yellow accent. "AVAILABLE BALANCE" mono label + huge mono balance (₹X,XX,XXX). Below: 2-col mini-stats "Locked in Escrow" / "Total Deposited" with mono digits.
5. Pull-to-refresh re-fires all 3 APIs.

### Path B — Top up via Razorpay
1. Add Funds section: 4 quick-amount chips (5,000 / 10,000 / 25,000 / 50,000) + custom rupee input + "Top Up" button (ink + yellow).
2. Tap chip → setTopupAmt(String(amt)) → chip becomes active (ink + yellow mono); custom input updates if typed.
3. Tap Top Up:
   - Token check → if missing, Alert + reset to Auth
   - createTopup(amountRupees) → returns { order_id, amount, key_id }
4. **Mock path** (order_id startsWith 'order_mock_') → verifyPayment immediately with mock fields → Alert success + clear input + reload wallet.
5. **Real path** → build HTML with checkout.js + Razorpay key + amount paise + theme '#0A0A0A' → setShowRazorpay(true) → open Modal.
6. WebView loads checkout.js, opens Razorpay modal automatically.
7. 3 message paths:
   - PAYMENT_SUCCESS → verifyPayment(payload) → wallet_balance refresh + Alert success + reload
   - PAYMENT_FAILED → setShowRazorpay(false) + Alert "Payment Failed" with error
   - PAYMENT_DISMISSED → setShowRazorpay(false) + Alert "Payment Cancelled"
8. Manual Modal close (Cancel button OR onRequestClose) → Alert "Payment Cancelled" + close.

### Path C — Save payout bank details
1. Payout Details section with 5 fields:
   - Account holder name * (required)
   - Bank name (optional)
   - Account number * (numeric-only, required)
   - IFSC code * (auto-uppercase, max 11, required)
   - UPI ID (optional, no auto-capitalize)
2. Save Payout Details button → validate holder/account/IFSC → updateMe with listing_data.bank_details payload → Alert "Saved" + setBrand local state.

### Path D — Transaction list
1. Recent Transactions section (max 15 rows).
2. Per-row: emoji icon (preserved per type) + type label + (optional) razorpay ref + date mono + amount (+/- colored: credit = success, debit = danger).
3. Empty → "No transactions yet" copy.
4. Below list: "View full transaction history on web" link card → openWebDashboard('/dashboard/wallet').

## Success
- All sections render with brandPalette + Outfit/PJS/Mono
- Top-up flow resolves to existing Razorpay verification + wallet balance refresh
- Bank details save to listing_data.bank_details correctly
- Transactions render with correct +/- coloring
- pnpm qa green (no overlap modulo env-flake)

## Failure / edge
- Session expired (no token / UNAUTHORIZED) → Alert + nav reset to Auth
- Invalid amount (< ₹1) → Alert "Invalid Amount"
- createTopup failure → Alert with res.error.message
- verifyTopup failure → Alert "If amount was debited, it will be refunded"
- Bank validation missing field → Alert "Required" with field-specific copy
- WebView dismiss / manual close → Alert "Payment Cancelled"
