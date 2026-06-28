# 04 — Workflow prediction (mockups)

## Mockups
- **`admin-commerce.html`** (S-A, web) — a **commerce rollup strip** (online-order
  count · GMV · platform fees · creator commission · pending settlement) above the
  orders table; the order row gains a **fee-tier** chip (Organic/Creator) +
  **settlement** chip (Held·date / Settled·date); the detail panel shows the full
  money breakdown (items · discount · net · commission · platform fee + tier ·
  **brand net**) + offer source + settlement.
- **`creator-sales-feed.html`** (S-C, mobile) — each sale row: who bought · product ·
  sale ₹ · **commission ₹ (X%)** · a status chip (**⏳ Pending · releases `<date>`**
  or **✓ Released**). Includes a window-credited (Way-4) sale row.
- **`brand-settlement.html`** (S-B, web) — rollup adds **Held vs Settled** totals;
  each order shows a **Held/Settled** chip + **"Payout by `<return-window date>`"**.
- **`follower-order-detail.html`** (S-D, mobile) — adds **Estimated delivery `<date>`**
  + a clean gross → savings → paid summary.

## Predicted behaviour
- Admin/brand numbers are read straight from `follower_transactions`
  (gross/discount/net/commission/marketplace_fee/brand_net) + the settlement
  columns (`brand_settlement_status`, `brand_settled_at`, `return_window_ends_at`).
  No recalculation — display only.
- Creator chip derives from `commission_confirmed_at` (released) vs
  `return_window_ends_at` (pending + release date) + `ci.commission_pct`.
- Fee-tier label needs the optional `l3_path` column (else the tier chip is
  hidden / shown as "—"). Founder decides the migration at build.
- Follower ETA = `follower_orders.estimated_delivery_date` (already set at order
  time); the payment summary reuses existing gross/discount/net.

## Not shown
- Delivery-SLA dashboard, real payout execution — separate/out of scope.
