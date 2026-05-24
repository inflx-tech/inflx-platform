# Workflow prediction — Flow 8

`mockups/web.html` shows the full wallet page at one viewport (the page is
a single scrollable surface — no sub-routes).

| Mockup section | Real source | Implementation note |
|---|---|---|
| Hero wallet card | derived from `walletApi.getBalance().wallet_balance` | yellow-pale gradient + 48px mono balance + inline Top-up CTA · "Last topped up" from most recent `topup` transaction |
| KPI strip (Available / Escrow / Deposited) | `wallet_balance` + `escrow_locked` + `total_deposited` | 3 mono tiles, ink number, muted sublabel |
| Top-up section | `walletApi.createTopup` + `verifyTopup` | Razorpay theme color `#FFC107` (only change to checkout config) |
| Transaction history | `walletApi.getTransactions({ limit: 20 })` | Filter chips are client-side `.filter()` on already-loaded array — no extra API call |
| Low-balance warning | `wallet_balance < 10000` | Adjacent-fix: threshold corrected from 1000000 (paise-era) |
| Bank account form (right rail) | `brandApi.getMe().listing_data.bank_details` + `brandApi.updateMe()` | Merge with existing listing_data preserved |
| "How wallet works" card | static copy | Placeholder doc links; no data fetch |
