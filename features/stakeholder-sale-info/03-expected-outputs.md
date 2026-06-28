# 03 — Expected outputs

## S-A Admin
- `adminOrders.controller.listOrders` SELECT adds `discount_amount`, `gross_amount`
  (items_total), `brand_net`, `offer_source`, `brand_settlement_status`,
  `brand_settled_at`, `return_window_ends_at` (and `l3_path` if the enabler ships).
- New `GET /admin/commerce-summary?days=N` → `{ online_order_count, gmv,
  platform_fees, influencer_commission, brand_net, pending_settlement }` (filtered
  `transaction_type='online_order'`).
- Admin orders page renders the rollup strip + the enriched detail panel.

## S-B Brand
- `brand.controller.listAllTransactions` / `listBrandOrders` SELECT adds
  `brand_settlement_status`, `brand_settled_at`, `return_window_ends_at`.
- `/dashboard/orders` row shows "Payout by `<date>`" + Held/Settled chip; summary
  adds ₹ held vs ₹ settled.

## S-C Creator
- `influencer.controller.getMyTransactions` SELECT adds `ci.commission_pct`,
  `ft.return_window_ends_at`, `ft.commission_confirmed_at` → derive status
  (`released` if confirmed, else `pending` + release date).
- `TransactionFeedScreen` row renders commission ₹ + `(X%)` + status chip.

## S-D Follower + ETA (admin-owned, distance-scaled, no hardcoding)
- Migration: `payment_config.delivery_ref_km int default 100` +
  `delivery_ref_days int default 2` (admin-editable on `/admin/settings/payments`,
  via paymentConfig.updateConfig allowed list + admin.controller destructure).
- `prepareSubOrder` computes: distance = haversine(`brands.lat/lng` →
  `follower_addresses.lat/lng`); `days = max(1, ceil(distance / ref_km × ref_days))`;
  coords missing → `ref_days`. Stamps `follower_orders.estimated_delivery_date =
  order_date + days`. Replaces the hardcoded `now + 2 days`. (Brand lat/lng,
  address lat/lng both nullable → fallback handles it.)
- `transaction.controller.getOrder` already returns `estimated_delivery_date`,
  `gross_amount`, `discount_amount`. `OrderDetailScreen` renders the ETA + a
  gross → savings → paid line. Brand/admin order views show the same ETA.

## Shared enabler (if approved)
- Migration: `follower_transactions.l3_path text` (nullable). `writeSubOrder`
  writes `sm.l3_path`. Admin/brand surfaces label it (Organic / Creator / Creator-window).
