# 02 · Workflow — Flow 8

## End-to-end happy paths (preserved verbatim)

### Page load
1. Brand visits `/dashboard/wallet`
2. Three parallel fetches on mount:
   - `walletApi.getBalance()` → returns `{ wallet_balance, escrow_locked, total_deposited, brand_id }`
   - `walletApi.getTransactions({ limit: 20 })` → returns most recent 20 `wallet_transactions` rows
   - `brandApi.getMe()` → reads `listing_data.bank_details` for pre-filling the bank form
3. Hero card + KPI strip render from balance data
4. Transaction history renders from transactions array
5. Bank form pre-fills if `listing_data.bank_details` exists

### Top-up
1. Brand enters rupee amount (or clicks a quick-pick chip)
2. Click "Top up" → `walletApi.createTopup(amountRupees)` (backend converts rupees → paise at Razorpay boundary)
3. Razorpay modal opens with `key_id`, `order_id`, `amount` (paise)
4. User completes payment → Razorpay callback fires with signature triple
5. Frontend calls `walletApi.verifyTopup({ razorpay_order_id, razorpay_payment_id, razorpay_signature })`
6. On success → toast + reset input + refresh balance
7. On failure → error toast, balance stays unchanged

### Save bank details
1. Brand fills account holder, bank name, account number, IFSC, optional UPI
2. Validation: holder + account + IFSC required; account_number strips non-digits; IFSC uppercased
3. `brandApi.getMe()` to fetch current `listing_data` (so we merge, not clobber)
4. `brandApi.updateMe({ listing_data: { ...existing, bank_details: {...} } })`
5. On success → toast

### Low-balance warning
- Renders inline when `wallet_balance < 10000` (rupees-era threshold — bug fix from `1000000`)
- Includes a CTA-style link to the Top-up section

## Error states (preserved)

- Razorpay script not loaded → "Razorpay not loaded" error toast
- Order creation failed → backend error message in toast
- Payment verification failed → "Payment verification failed" toast
- Bank save failed → backend error message in toast
- Required bank fields empty → inline validation toast (no API call)

## NO-TOUCH preserved

- Razorpay theme color update is the ONLY change to the checkout config (orange → yellow). The `key_id`, `order_id`, `amount`, `currency`, `name`, `description`, `handler` wiring is unchanged.
- Bank-details merge logic preserved (fetches current `listing_data` first to merge, never clobbers other listing fields)
- All toast pattern + state hooks preserved
- Brand approval gate from `layout.js` inherited (no per-page recheck)
