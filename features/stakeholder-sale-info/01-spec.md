# 01 — Spec: stakeholder-sale-info

Locked framing with the founder 2026-06-28. After an online-order sale, **each
login must show that sale correctly, with the breakdown that role needs.** Audit
(2026-06-28, file:line) found most exists; this contract fills the gaps.

## Slices
- **S-A — Admin (biggest gap).** Admin order detail today shows only net /
  commission / platform-fee. Add per-order **discount · gross · brand-net ·
  offer-source · fee-tier · settlement status**, plus a **commerce rollup** card
  (online-order GMV · fees collected · commission paid · pending settlement).
- **S-B — Brand.** Per-order full breakdown + revenue rollup already exist. Add
  **settlement timing**: "Payout by `<return-window date>`" + pending/settled
  status per order + a pending-vs-settled summary.
- **S-C — Creator.** Sales feed shows who-bought + product + amount + commission
  amount. Add **commission % + release date + pending/confirmed status** inline
  in the feed (data already computed in commission.service). Way-4 window sales
  already appear in the feed.
- **S-D — Follower.** OrderDetail is comprehensive; add **estimated delivery
  date** + gross/savings line.
  - **ETA ownership (founder-locked 2026-06-28): ADMIN-owned, distance-scaled, NO
    hardcoding.** The admin sets ONE simple rule — a reference **distance + days**
    (e.g. "100 km = 2 days"). The system measures the real distance and scales:
    - Admin config (global, on `/admin/settings/payments`): `delivery_ref_km`
      (default 100) + `delivery_ref_days` (default 2).
    - At order confirmation: distance = haversine(`brands.lat/lng` →
      `follower_addresses.lat/lng`); **days = ceil(distance / ref_km × ref_days)**,
      floored at 1 day for any real distance.
    - **Graceful fallback:** coords missing → `delivery_ref_days` (the base unit).
    - Computed in `prepareSubOrder`, stamped on
      `follower_orders.estimated_delivery_date`; shown to follower + brand + admin.
      Replaces the hardcoded `order + 2 days`. No per-category, no fixed tiers.

## Shared enabler (decide at build)
The fee TIER/path (organic `path_a` / creator-direct `path_b` / creator-window
`path_c`) is computed in `pricing.service` but **not persisted** on
`follower_transactions`. To show "which tier applied" (S-A, optionally S-B), add a
small `l3_path` column (migration) written in `writeSubOrder` (subMeta already
carries `l3_path`). Founder migrate-go required.

## Out of scope
- Delivery-SLA dashboards / stuck-order alerts (separate admin-monitoring slice).
- Real settlement payout execution (Razorpay Route, Program B).

## Acceptance
- Admin sees the full per-order money breakdown + a commerce rollup + settlement
  status. Brand sees when it gets paid + settled status. Creator sees commission %
  + release date + pending/confirmed in the feed. Follower sees ETA.
- `pnpm qa` green; mobile jest green; brand-web builds; mockups locked first.
