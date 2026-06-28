# 02 — Workflow

A single online-order sale, seen four ways:

## Admin (S-A)
1. Open `/admin/orders` → a **commerce rollup** strip at top: online-order count ·
   GMV · platform fees collected · influencer commission · pending settlement (₹).
2. Open an order → full money breakdown: items total · discount · net (customer
   paid) · influencer commission · platform fee (+ tier: organic/creator) · brand
   net · offer source · settlement status (held until `<date>` / settled `<date>`).

## Brand (S-B)
1. `/dashboard/orders` rollup already shows revenue/brand-net/commission.
2. Each order row now shows **"Payout by `<return-window date>`"** + a status chip
   (Held / Settled). A small summary: ₹ held vs ₹ settled.

## Creator (S-C)
1. Sales feed (TransactionFeed): each sale row shows who bought · product · sale ₹
   · **commission ₹ (X%)** · a status chip — **Pending · releases `<date>`** or
   **Released ✓**.
2. Earnings (wallet / pending / total) unchanged.

## Follower (S-D)
1. OrderDetail shows the existing timeline + items + address + courier, plus
   **Estimated delivery `<date>`** and a clear gross→savings→paid line.
