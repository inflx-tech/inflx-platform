# 05 — Impact

**Verdict:** mostly read-path enrichment (more columns in existing SELECTs + UI
fields) + one new admin summary endpoint. Optional small migration (`l3_path`).

## Surfaces
- **S-A:** backend `adminOrders.controller.js` (listOrders SELECT + new
  `getCommerceSummary`), `admin` routes; web `app/admin/orders/page.js` (rollup +
  detail). 
- **S-B:** backend `brand.controller.js` (SELECTs); web `app/dashboard/orders/page.js`
  (+ mobile `BrandOrdersScreen.js`).
- **S-C:** backend `influencer.controller.js` `getMyTransactions` SELECT; mobile
  `screens/influencer/TransactionFeedScreen.js`.
- **S-D:** mobile `screens/follower/OrderDetailScreen.js` (display only).
- **Enabler (optional):** migration `follower_transactions.l3_path` +
  `transaction.controller.js` writeSubOrder.

## Deploy
- Production-impacting — backend → Render, web → Vercel, mobile → OTA. Migration
  only if the `l3_path` enabler is approved (migrate-first, founder go).
  `release.released` stays false (no Maestro).

## Risk
- Low. Additive read-path fields + a new read endpoint; no change to money
  calculation or order placement. Settlement status is read-only display of
  existing `brand_settlement_status` (set by the settlement job).
