# 06 — Before / after notes

**Before:** `BrandStoreScreen` (non-restaurant) ran a **hardcoded** body — it grouped
the brand's products by `section` in the frontend and rendered a fixed grid,
**ignoring any admin composition**. So composing a business page in App Builder did
nothing for fashion/furniture/etc stores (only the food page rendered admin sections).

**After:** `BrandStoreScreen` fetches `getBusinessSections(brand_id)` and, when the
admin has composed a page, renders that stack via the **generic `SectionItem`
engine** (the same one the food `RestaurantDetailScreen` + Home use). When nothing
is composed, it falls back to the product grid (store never empty). Header, CTAs
(pay/book/order/enquire), cart bar and the restaurant dispatch are unchanged.

## Delivered
- `BrandStoreScreen.js` — `+ getBusinessSections` fetch (`bizSections`); products
  tab = `bizSections.length ? <SectionItem stack/> : <product grid fallback/>`;
  `+ import { SectionItem }`.

## Why no mockup
The look IS the live section engine (admin-composed) + the existing brand chrome —
nothing new to design (founder waived). Same pattern already shipped + live for the
food page. Reusable for the creator store + category page next.

## Verification
- babel-clean (BrandStoreScreen); mobile jest 25/25 (FollowerWallet baseline excl.);
  no backend touched (`pnpm qa` unaffected).
- Live-verify: compose a `business` section stack for a brand in App Builder → its
  store renders it; a brand with none shows its product grid.
