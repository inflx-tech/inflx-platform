# 06 — Before / after notes

Each login now shows the sale with the breakdown it needs. Tier chip left OUT
(no `l3_path` migration); creator handle + fee amount convey creator-vs-organic.

## S-D + ETA (admin-owned, distance-scaled)
**Before:** delivery date was a hardcoded `order + 2 days`; follower order detail
showed no ETA, no gross/savings split.
**After:** admin sets one rule on `/admin/settings/payments` —
`delivery_ref_km` + `delivery_ref_days` (migration 121, default 100km/2d). At order
confirmation `prepareSubOrder` computes `days = max(1, ceil(haversine(brand↔address)
/ ref_km × ref_days))` (coords missing → ref_days) and stamps
`follower_orders.estimated_delivery_date`. `OrderDetailScreen` shows "Estimated
delivery by `<date>`" + an Item total → Savings → Paid summary.
Files: migration 121 + run-121, `paymentConfig.service`, `transaction.controller`
(haversine + computeEtaDate), `admin.controller` + `admin/settings/payments` (inputs),
`OrderDetailScreen.js`.

## S-C creator
**Before:** the sales feed showed who bought + product + commission ₹, but not the
% or release status (only in the deep campaign view).
**After:** `getMyTransactions` SELECT adds `ci.commission_pct`,
`ft.return_window_ends_at`, `ft.commission_confirmed_at`; `TransactionFeedScreen`
row shows commission ₹, `· X%` on the SALE line, and a chip — "⏳ Pending ·
releases `<date>`" or "✓ Released to wallet". Way-4 window sales already appear.

## S-A admin
**Before:** order list showed net/commission/platform-fee only; no rollup; thinner
than the brand view.
**After:** `listOrders` SELECT adds discount/gross/brand_net/offer_source +
settlement (`brand_settlement_status`/`brand_settled_at`); new
`GET /admin/commerce-summary` (count · GMV · fees · commission · pending
settlement). `admin/orders` page: rollup strip + full money breakdown panel +
settlement chip (Held·date / Settled·date).

## S-B brand
**Before:** per-order breakdown + revenue rollup existed; no settlement timing.
**After:** `listAllTransactions`/`listBrandOrders` SELECTs add
`brand_settlement_status`/`brand_settled_at`/`return_window_ends_at`; summary adds
held vs settled brand-net. `dashboard/orders`: a **Payout** row (Held · by `<date>`
/ Settled · `<date>`) + "held · settled" under Your Net.

## Verification
- backend loads; migration 121 applied to local dev DB; `pnpm qa` (see deploy);
  mobile jest **25/25** (FollowerWallet baseline excl.).
- Deploy: migrate-first (run-121 to prod, founder go) → commit → push (Render +
  Vercel) → OTA. No `l3_path` migration (tier chip out).
