# Expected outputs — Offer/discount section rules (Phase 3d)

## Automated
1. `node --check` (sectionRules, sectionLibrary) + engine require smoke.
2. `pnpm qa` → GREEN gate 0, zero regression.
3. `pnpm qa:db` → validation test passes (has_offer/min_discount_pct accepted; min clamped 0–100).
4. brand-web build exit 0.

## Behavioural (admin + follower, after deploy)
5. Builder shows **"Has a live offer"** toggle + **"Minimum discount %"** input under the rule fields.
6. **Min discount 20%**: live preview count = only products that carry a live store offer giving
   ≥20% off (pct offers directly; flat ₹ offers computed vs price; store-wide offers count for all
   the brand's products).
7. **Has offer**: count = only products with any live store offer (any type, incl. BOGO/bundle).
8. Both off → behaves exactly as before (no offer filtering).
9. Rendered shelf (placed section) honors the same filtering, stacked with category/tags/price + context.

## Non-goals (NOT here)
- Creator-allocated-offer discount filtering (fast-follow). Non-discount % math. Migration.
