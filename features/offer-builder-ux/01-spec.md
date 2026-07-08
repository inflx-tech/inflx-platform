# offer-builder-ux — offer builder reorder, scope-gated value, searchable finders

## Founder asks (2026-07-08), Phase 1b — frontend-only (OfferBuilder.js)
1. **Applies-to BEFORE the value** for Discount and Volume: ask store/category/
   product FIRST, then the amount.
2. **Scope-gates the value type**: Whole store → % only; Category → % only;
   Product → % or ₹ (flat only makes sense on a single product).
3. **Real categories, searchable**: category scope currently shows a plain
   dropdown of `product.section`. Offers MATCH on `bp.section`, so the options
   are the brand's real catalogue sections (complete — getProducts is
   unpaginated). Present them in a clean, searchable picker; empty state points
   to listing.
4. **Searchable product finder everywhere** a product is chosen (discount-
   products, volume-products, bundle, free-gift, BOGO) — replaces the flat
   `<select>` of the whole catalogue (unusable at large inventory). Type-to-
   search + grouped-by-section + price; multi picks show as removable chips.
5. **CTA-applicability hint**: show where the built offer applies (online order
   vs pay-at-store bill), since free-form bill paths can't honor category/
   product scope.

## Explicitly NOT in this contract
- BOGO redefinition (same-product) and quantity-volume tiers → Phase 3
  (backend shapes). BOGO/volume keep their CURRENT meaning here.
- Any backend/offer-config change. Payload shape (offerConfig.validator)
  unchanged; store/category force sub_type='pct' in the existing shape.

## Scope (files)
- `Packages/brand-web/components/OfferBuilder.js` — reorder Discount + Volume
  (applies-to first), scope-gate the value toggle, new searchable ProductFinder
  (single + multi), searchable category picker, CTA hint line.
- OffersLibrary passes `products` (already) — no new data fetch needed.

## Acceptance
Discount: pick Whole store → only "% off" shown; pick Product → % / ₹ toggle
appears, and a searchable finder to pick products. Category shows a searchable
list of real sections. Volume asks applies-to first. Every product picker is
searchable. `pnpm qa` GREEN; brand-web builds.
