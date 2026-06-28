# 02 — Workflow

## Admin
1. In App Builder (business scope), compose the brand's page = a stack of sections
   (banners, product rails, creator rails, etc.) with their rules + tap-destinations.

## Follower
1. Open a brand store → the app fetches `getBusinessSections(brand_id)`.
2. **Composed:** the store renders the admin's section stack (generic engine).
3. **Not composed:** the store shows the product grid (per-section) as a fallback.
4. The brand header, CTAs (pay/book/order/enquire) and cart bar are unchanged.
5. Restaurants continue to dispatch to `RestaurantDetailScreen` (already composed).

## Engineer
- One-time: the generic renderer (`SectionItem`) already exists; this contract
  just wires `BrandStoreScreen` to it. New pages later cost zero per-page code.
