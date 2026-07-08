# Before/after — offer-builder-ux

## Before
- Discount asked the value (% / ₹) FIRST, then "Applies to". ₹ flat was
  offerable even for whole-store/category (meaningless).
- Category scope = a plain `<select>` of `product.section`.
- Every product slot (discount-products, volume-products, bundle, free-gift,
  BOGO) = a flat `<select>` of the whole catalogue — unusable at large inventory.

## After (OfferBuilder.js, frontend-only)
- **Discount + Volume ask "Applies to" FIRST**, then the value.
- **Value type scope-gated**: Whole store / Category → "% off" only; Products →
  % / ₹ toggle. Switching scope to store/category coerces `sub_type='pct'` so a
  stale flat value can't produce a meaningless store-wide ₹-off.
- **Searchable ProductFinder** (module-level, own search state) replaces every
  flat select: type name/SKU → section-grouped results with price; multi-picks
  show removable chips; single-select (BOGO buy/get, free-gift main/gift) shows
  the pick as a chip.
- **Searchable CategoryPicker** over the brand's real catalogue sections (offers
  match `bp.section`; getProducts is complete/unpaginated).
- **CTA-applicability hint** under each config: online-order vs pay-at-store
  bill scope reality.

## Unchanged
- Payload shape (buildOfferConfig / draftFromOffer / previewLine) identical —
  offerConfig.validator + follower app read the same JSON. Existing offers open
  and edit identically. BOGO/volume keep their current meaning (redefinition +
  quantity-volume = Phase 3).

## Verification
- brand-web `next build` ✓ compiled; no dangling refs to removed helpers
  (SingleSelect/MultiPicker/ScopeToggle).
- `pnpm qa` GREEN (79). Frontend-only (Vercel); no backend, no OTA.
- After-capture owed on founder walkthrough of the New-offer modal.
