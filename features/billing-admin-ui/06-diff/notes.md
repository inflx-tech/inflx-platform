# Before/After notes — billing-admin-ui (Phase A7-admin)

## What changed visually
- 4 new admin pages mirror the **existing** `/admin/escrow-fees` styling pattern verbatim — same Tailwind tokens (`bg-navy`, `text-t1/t2/t3`, `bg-surface2`, `border-border`, `font-display`), same edit-mode toggle, same toast pattern, same row-grid layout.
- 2 new nav entries added under FINANCE (`Active Subs`, `Sub Invoices`) and 1 new PRICING section with 2 entries (`Tiers (L1)`, `Categories (L3)`). Section style matches existing.

## Why no separate mockup HTMLs
Founder direction 2026-05-23: "we are not planning any UI/UX change" for admin. The visual contract is the existing `/admin/escrow-fees` (admin-web) page; new pages are an exact pattern clone. No new design surface introduced.

## Pages added (visual reference paths)
- `/admin/pricing/tiers` — 4-row editable table (subscription_tiers).
- `/admin/pricing/categories` — 16-row editable table (categories) with add/delete row + per-row Edit/Save.
- `/admin/subscriptions` — read-only queue with filters.
- `/admin/billing/invoices` — read-only invoice list with status/tier/brand filters + running paid-sum.

## Diff sign-off
- Layout / spacing / colors: indistinguishable from existing admin pages by design.
- New page route: 4 routes verified by nav-sweep (Playwright) — pages resolve under admin auth, no 404, no auth bounce.
- Backend behaviour: 7 new assertions confirm the API contract for tiers / categories / subscriptions / invoices.

Reference: pull `/admin/escrow-fees` for the visual identity these new pages preserve.
