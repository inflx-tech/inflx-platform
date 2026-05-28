# 05-impact — wave2-brand-wallet-withdrawal

**Verdict: additive, real-money-out. New table + endpoints + UI; one new
enum value. Zero change to existing read/write paths — `getWallet`, topup,
escrow, influencer withdrawals all untouched.**

## Mechanics
- **Migration M075** is additive: a new `wallet_tx_type` value (`withdrawal`),
  a new enum type, a new table + index. No column drops, no backfill, no
  change to existing rows. Forward-only; safe to apply before code deploy.
- **`getWallet` untouched.** The breakdown stays correct because its FILTER
  clauses never match `type='withdrawal'`. Available reflects the wallet
  debit automatically.
- **Money safety:** funds are reserved at request (single `FOR UPDATE`
  transaction) and refunded on both reject and payout-failure — the wallet
  can never be debited without either a completed payout or a refund.
- **New surfaces only:** new routes (`/brands/me/wallet/withdraw`,
  `/admin/brand-withdrawals`) + new service functions. Existing influencer
  withdrawal + admin payout code paths are not modified.
- **UI:** the wallet page gains one card (reusing the locked `.w` palette);
  the admin payouts page gains a scope toggle while the influencer view
  renders byte-for-byte as before.

## Deploy posture
PRODUCTION-IMPACTING + MIGRATION (M075). Surfaced for explicit go; M075
batched with M076 for one combined prod migration at the end of Wave 2.
Code push (Render + Vercel) must coincide with M075 on prod — the withdraw
endpoint INSERTs into `brand_withdrawals`, which has no `?? default` fallback
(it's a table, not a column), so the push is paired with the migration go.

## Regression
`pnpm qa` stays GREEN (no Playwright workflow touches wallet/withdrawal).
Backend boot smoke clean. New backend jest coverage in
`brand-withdrawal.test.js`.
